package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/internal/rosfmt"
	"github.com/quiqxiq/rosmon/service/devmgr"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/quiqxiq/rosmon/workflows"
	"github.com/sirupsen/logrus"
)

// ProfileConfig handler untuk endpoint /devices/{device_id}/hotspot/profile-configs.
// Backward-compatible shim di atas HotspotProfileStore (role=voucher).
//
// Read/write DB selalu jalan walau router offline. DevMgr dipakai untuk best-effort
// auto-inject on-login script ke router saat Upsert/Sync.
type ProfileConfig struct {
	Store        store.HotspotProfileStore
	DevMgr       *devmgr.Manager
	GoServiceURL string
	Log          *logrus.Logger
}

func NewProfileConfig(s store.HotspotProfileStore, devMgr *devmgr.Manager, goServiceURL string, log *logrus.Logger) *ProfileConfig {
	if log == nil {
		log = logrus.New()
	}
	return &ProfileConfig{Store: s, DevMgr: devMgr, GoServiceURL: goServiceURL, Log: log}
}

func (h *ProfileConfig) Register(dev *gin.RouterGroup) {
	h.RegisterSplit(dev, dev)
}

func (h *ProfileConfig) RegisterSplit(readGroup, writeGroup *gin.RouterGroup) {
	r := readGroup.Group("/hotspot/profile-configs")
	r.GET("", h.List)
	r.GET("/:profile_name", h.Get)

	w := writeGroup.Group("/hotspot/profile-configs")
	w.POST("/sync", h.Sync)
	w.PUT("/:profile_name", h.Upsert)
	w.DELETE("/:profile_name", h.Delete)
}

func (h *ProfileConfig) List(c *gin.Context) {
	deviceID, ok := parseDeviceIDForConfig(c)
	if !ok {
		return
	}
	cfgs, err := h.Store.ListByDevice(c.Request.Context(), deviceID, store.HotspotProfileListFilter{Role: "voucher"})
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.ProfileConfigResponse, len(cfgs))
	for i, cfg := range cfgs {
		out[i] = dto.FromModelHotspotProfileConfig(cfg)
	}
	WriteList(c, out, len(out))
}

func (h *ProfileConfig) Get(c *gin.Context) {
	deviceID, ok := parseDeviceIDForConfig(c)
	if !ok {
		return
	}
	profileName := c.Param("profile_name")
	p, err := h.Store.GetByName(c.Request.Context(), deviceID, profileName)
	if err != nil {
		if errors.Is(err, store.ErrHotspotProfileNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "profile config not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelHotspotProfileConfig(p))
}

func (h *ProfileConfig) Upsert(c *gin.Context) {
	deviceID, ok := parseDeviceIDForConfig(c)
	if !ok {
		return
	}
	profileName := c.Param("profile_name")

	var req dto.ProfileConfigUpsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	normalized, err := rosfmt.NormalizeDuration(req.Validity)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.ErrDetails("VALIDATION", "invalid validity format",
				c.Request.URL.Path, err.Error()))
		return
	}

	p := &model.HotspotProfile{
		DeviceID:   deviceID,
		Name:       profileName,
		Role:       "voucher",
		ExpiryMode: req.ExpiryMode,
		Validity:   normalized,
		Price:      req.Price,
		SellPrice:  req.SellPrice,
		LockMAC:    req.LockMAC,
	}
	// Use Create/Update directly (not Upsert) so that operator-supplied fields
	// are written to DB. Upsert preserves those fields and is only for sync.
	existing, lookupErr := h.Store.GetByName(c.Request.Context(), deviceID, profileName)
	var created bool
	if errors.Is(lookupErr, store.ErrHotspotProfileNotFound) {
		created = true
		if err := h.Store.Create(c.Request.Context(), p); err != nil {
			WriteErr(c, err)
			return
		}
	} else if lookupErr == nil {
		p.ID = existing.ID
		if err := h.Store.Update(c.Request.Context(), p); err != nil {
			WriteErr(c, err)
			return
		}
	} else {
		WriteErr(c, lookupErr)
		return
	}
	// Re-read for fresh timestamps.
	persisted, err := h.Store.GetByName(c.Request.Context(), deviceID, profileName)
	if err != nil {
		WriteErr(c, err)
		return
	}

	h.tryInjectOnLogin(c, deviceID, persisted)

	if created {
		WriteCreated(c, dto.FromModelHotspotProfileConfig(persisted))
	} else {
		WriteOK(c, dto.FromModelHotspotProfileConfig(persisted))
	}
}

func (h *ProfileConfig) Delete(c *gin.Context) {
	deviceID, ok := parseDeviceIDForConfig(c)
	if !ok {
		return
	}
	profileName := c.Param("profile_name")
	p, err := h.Store.GetByName(c.Request.Context(), deviceID, profileName)
	if err != nil {
		if errors.Is(err, store.ErrHotspotProfileNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "profile config not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if err := h.Store.Delete(c.Request.Context(), p.ID); err != nil {
		if errors.Is(err, store.ErrHotspotProfileInUse) {
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", "profile still referenced by subscription", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func parseDeviceIDForConfig(c *gin.Context) (uint, bool) {
	raw := c.Param("device_id")
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ID", "invalid device id", raw))
		return 0, false
	}
	return uint(n), true
}

// Sync POST /hotspot/profile-configs/sync.
func (h *ProfileConfig) Sync(c *gin.Context) {
	deviceID, ok := parseDeviceIDForConfig(c)
	if !ok {
		return
	}
	if h.DevMgr == nil {
		c.AbortWithStatusJSON(http.StatusServiceUnavailable,
			dto.Err("UNAVAILABLE", "device manager not configured", c.Request.URL.Path))
		return
	}
	cs, err := h.DevMgr.Get(deviceID)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusServiceUnavailable,
			dto.Err("DEVICE_OFFLINE", "device not connected: "+err.Error(), c.Request.URL.Path))
		return
	}

	res, err := workflows.SyncProfiles(c.Request.Context(), cs.WF, h.Store, deviceID, h.GoServiceURL)
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.ProfileConfigSyncResponse{
		Synced:       nilToEmpty(res.Synced),
		Created:      nilToEmpty(res.Created),
		Orphan:       nilToEmpty(res.Orphan),
		Injected:     nilToEmpty(res.Injected),
		InjectFailed: nilToEmpty(res.InjectFailed),
		Skipped:      []string{},
	})
}

func (h *ProfileConfig) tryInjectOnLogin(c *gin.Context, deviceID uint, p model.HotspotProfile) {
	if h.DevMgr == nil {
		return
	}
	cs, err := h.DevMgr.Get(deviceID)
	if err != nil {
		h.Log.WithError(err).WithField("profile", p.Name).
			Debug("profile_config: skip auto-inject (device offline)")
		return
	}
	if err := workflows.InjectOnLoginScript(
		c.Request.Context(), cs.WF, p.Name,
		workflows.OnLoginConfig{
			ExpiryMode: p.ExpiryMode,
			Validity:   p.Validity,
			Price:      p.Price,
			SellPrice:  p.SellPrice,
			LockMAC:    p.LockMAC,
		},
		deviceID, h.GoServiceURL,
	); err != nil {
		h.Log.WithError(err).WithField("profile", p.Name).
			Warn("profile_config: auto-inject on-login failed (config saved)")
	}
}

func nilToEmpty(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
