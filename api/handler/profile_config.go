package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/roslib-mikhmon/api/dto"
	"github.com/quiqxiq/roslib-mikhmon/internal/rosfmt"
	"github.com/quiqxiq/roslib-mikhmon/service/devmgr"
	"github.com/quiqxiq/roslib-mikhmon/store"
	"github.com/quiqxiq/roslib-mikhmon/store/model"
	"github.com/quiqxiq/roslib-mikhmon/workflows"
	"github.com/sirupsen/logrus"
)

// ProfileConfig handler untuk endpoint /devices/{device_id}/hotspot/profile-configs.
//
// Read/write DB selalu jalan walau router offline (config lokal di postgres,
// terpisah dari profile router-side). DevMgr dipakai untuk best-effort
// auto-inject on-login script ke router saat Upsert / Sync — kalau router
// offline, DB tetap di-update dan inject di-skip dengan log warning.
//
// GoServiceURL adalah URL absolut Go service yang reachable dari router
// (mis. "http://192.168.1.10:8080"), digunakan untuk membentuk webhook URL
// di on-login script. Kalau kosong, webhook block tidak di-emit (selling
// record akan di-skip).
type ProfileConfig struct {
	Store        store.ProfileConfigStore
	DevMgr       *devmgr.Manager
	GoServiceURL string
	Log          *logrus.Logger
}

// NewProfileConfig constructor.
//
// devMgr & goServiceURL boleh nil/kosong — sync & auto-inject akan
// di-skip dengan return code yang sesuai. log boleh nil (no-op logger
// di-fallback).
func NewProfileConfig(s store.ProfileConfigStore, devMgr *devmgr.Manager, goServiceURL string, log *logrus.Logger) *ProfileConfig {
	if log == nil {
		log = logrus.New()
	}
	return &ProfileConfig{Store: s, DevMgr: devMgr, GoServiceURL: goServiceURL, Log: log}
}

// Register mount endpoint di group `dev` (sudah ada :device_id di parent).
//
// PENTING: dipasang di scope yang TIDAK pakai DeviceMiddleware
// (lookup di-handle handler sendiri pakai DeviceStore), karena config
// tetap dapat di-baca/edit meski router offline.
func (h *ProfileConfig) Register(dev *gin.RouterGroup) {
	g := dev.Group("/hotspot/profile-configs")
	g.GET("", h.List)
	g.POST("/sync", h.Sync)
	g.GET("/:profile_name", h.Get)
	g.PUT("/:profile_name", h.Upsert)
	g.DELETE("/:profile_name", h.Delete)
}

func (h *ProfileConfig) List(c *gin.Context) {
	deviceID, ok := parseDeviceIDForConfig(c)
	if !ok {
		return
	}
	cfgs, err := h.Store.ListByDevice(c.Request.Context(), deviceID)
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.ProfileConfigResponse, len(cfgs))
	for i, cfg := range cfgs {
		out[i] = dto.FromModelProfileConfig(cfg)
	}
	WriteList(c, out, len(out))
}

func (h *ProfileConfig) Get(c *gin.Context) {
	deviceID, ok := parseDeviceIDForConfig(c)
	if !ok {
		return
	}
	profileName := c.Param("profile_name")
	cfg, err := h.Store.GetByName(c.Request.Context(), deviceID, profileName)
	if err != nil {
		if errors.Is(err, store.ErrProfileConfigNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "profile config not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelProfileConfig(cfg))
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
	// Normalize validity: accept "168h"/"7d"/"1w" → canonical RouterOS format.
	normalized, err := rosfmt.NormalizeDuration(req.Validity)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.ErrDetails("VALIDATION", "invalid validity format",
				c.Request.URL.Path, err.Error()))
		return
	}

	cfg := &model.HotspotProfileConfig{
		DeviceID:    deviceID,
		ProfileName: profileName,
		ExpiryMode:  req.ExpiryMode,
		Validity:    normalized,
		Price:       req.Price,
		SellPrice:   req.SellPrice,
		LockMAC:     req.LockMAC,
	}
	created, err := h.Store.UpsertResult(c.Request.Context(), cfg)
	if err != nil {
		WriteErr(c, err)
		return
	}
	// Re-read untuk mendapatkan timestamps fresh.
	persisted, err := h.Store.GetByName(c.Request.Context(), deviceID, profileName)
	if err != nil {
		WriteErr(c, err)
		return
	}

	// Best-effort auto-inject on-login script ke router.
	// Kalau router offline atau profile tidak ada di router → log warning,
	// JANGAN gagalkan request (DB write sudah sukses, operator bisa
	// trigger sync manual nanti).
	h.tryInjectOnLogin(c, deviceID, persisted)

	if created {
		WriteCreated(c, dto.FromModelProfileConfig(persisted))
	} else {
		WriteOK(c, dto.FromModelProfileConfig(persisted))
	}
}

func (h *ProfileConfig) Delete(c *gin.Context) {
	deviceID, ok := parseDeviceIDForConfig(c)
	if !ok {
		return
	}
	profileName := c.Param("profile_name")
	if err := h.Store.DeleteByName(c.Request.Context(), deviceID, profileName); err != nil {
		if errors.Is(err, store.ErrProfileConfigNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "profile config not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

// parseDeviceIDForConfig ambil :device_id dari path (numeric). Tulis 400
// kalau invalid dan return ok=false.
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
//
// Tarik semua profile dari router → reconcile dengan DB:
//   - Profile router yang belum ada di DB → insert default ExpiryMode="0".
//   - Profile DB yang masih ada di router → on-login script di-inject
//     (best-effort, error per-profile masuk inject_failed list).
//   - Profile DB yang sudah hilang dari router → masuk orphan list
//     (tidak dihapus otomatis).
//
// Membutuhkan device online (router connection). Return 503 kalau offline.
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
		Skipped:      nilToEmpty(res.Skipped),
	})
}

// tryInjectOnLogin best-effort push on-login script ke router. Tidak
// gagalkan request kalau router offline atau profile tidak ada — DB
// write sudah persisted, operator bisa trigger sync manual nanti.
func (h *ProfileConfig) tryInjectOnLogin(c *gin.Context, deviceID uint, cfg model.HotspotProfileConfig) {
	if h.DevMgr == nil {
		return
	}
	cs, err := h.DevMgr.Get(deviceID)
	if err != nil {
		h.Log.WithError(err).WithField("profile", cfg.ProfileName).
			Debug("profile_config: skip auto-inject (device offline)")
		return
	}
	if err := workflows.InjectOnLoginScript(
		c.Request.Context(), cs.WF, cfg.ProfileName,
		workflows.OnLoginConfig{
			ExpiryMode: cfg.ExpiryMode,
			Validity:   cfg.Validity,
			Price:      cfg.Price,
			SellPrice:  cfg.SellPrice,
			LockMAC:    cfg.LockMAC,
		},
		deviceID, h.GoServiceURL,
	); err != nil {
		h.Log.WithError(err).WithField("profile", cfg.ProfileName).
			Warn("profile_config: auto-inject on-login failed (config tetap di-save)")
	}
}

// nilToEmpty memastikan slice nil di-encode sebagai `[]` di JSON, bukan `null`.
func nilToEmpty(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}
