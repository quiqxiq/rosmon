package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/roslib-mikhmon/api/dto"
	"github.com/quiqxiq/roslib-mikhmon/mikrotik"
	"github.com/quiqxiq/roslib-mikhmon/mikrotik/hotspot"
	"github.com/quiqxiq/roslib-mikhmon/mikrotik/ppp"
	"github.com/quiqxiq/roslib-mikhmon/service/devmgr"
	"github.com/quiqxiq/roslib-mikhmon/store"
	"github.com/quiqxiq/roslib-mikhmon/store/model"
	"github.com/sirupsen/logrus"
)

// propagateTimeout — batas waktu best-effort sync ke router saat mutasi.
// DB write tetap authoritative; kalau router gagal/lambat, response berisi
// warning agar operator bisa retry.
const propagateTimeout = 5 * time.Second

// BandwidthProfiles handler untuk
//   GET    /devices/:device_id/bandwidth-profiles
//   POST   /devices/:device_id/bandwidth-profiles
//   GET    /devices/:device_id/bandwidth-profiles/:id
//   PUT    /devices/:device_id/bandwidth-profiles/:id
//   DELETE /devices/:device_id/bandwidth-profiles/:id
//   POST   /devices/:device_id/bandwidth-profiles/sync
//
// DB-first: semua mutasi tulis ke DB dulu lalu best-effort propagate ke
// router. Kalau router offline, DB tetap di-tulis dan response berisi
// warning. Operator bisa pakai POST .../sync untuk recover.
type BandwidthProfiles struct {
	Store  store.BandwidthProfileStore
	DevMgr *devmgr.Manager
	Log    *logrus.Logger
}

func NewBandwidthProfiles(s store.BandwidthProfileStore, devMgr *devmgr.Manager, log *logrus.Logger) *BandwidthProfiles {
	if log == nil {
		log = logrus.New()
	}
	return &BandwidthProfiles{Store: s, DevMgr: devMgr, Log: log}
}

// Register mount ke parent group `dev` (yang sudah ada :device_id di path).
// Tidak pakai DeviceMiddleware — handler do best-effort sendiri supaya
// DB tetap dapat di-akses meski router offline.
func (h *BandwidthProfiles) Register(dev *gin.RouterGroup) {
	g := dev.Group("/bandwidth-profiles")
	g.GET("", h.List)
	g.POST("", h.Create)
	g.POST("/sync", h.Sync)
	g.GET("/:id", h.Get)
	g.PUT("/:id", h.Update)
	g.DELETE("/:id", h.Delete)
}

func (h *BandwidthProfiles) List(c *gin.Context) {
	deviceID, ok := parseDeviceIDForBW(c)
	if !ok {
		return
	}
	f := store.BandwidthProfileListFilter{
		ServiceType: c.Query("service_type"),
		OnlyActive:  c.Query("only_active") == "true",
	}
	items, err := h.Store.ListByDevice(c.Request.Context(), deviceID, f)
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.BandwidthProfileResponse, len(items))
	for i, it := range items {
		out[i] = dto.FromModelBandwidthProfile(it)
	}
	WriteList(c, out, len(out))
}

func (h *BandwidthProfiles) Get(c *gin.Context) {
	deviceID, ok := parseDeviceIDForBW(c)
	if !ok {
		return
	}
	id, ok := parseBWProfileID(c)
	if !ok {
		return
	}
	p, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrBandwidthProfileNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "bandwidth profile not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if p.DeviceID != deviceID {
		c.AbortWithStatusJSON(http.StatusNotFound,
			dto.Err("NOT_FOUND", "bandwidth profile not found for this device", c.Request.URL.Path))
		return
	}
	WriteOK(c, dto.FromModelBandwidthProfile(p))
}

func (h *BandwidthProfiles) Create(c *gin.Context) {
	deviceID, ok := parseDeviceIDForBW(c)
	if !ok {
		return
	}
	var req dto.BandwidthProfileCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	active := true
	if req.Active != nil {
		active = *req.Active
	}
	sharedUsers := req.SharedUsers
	if sharedUsers == 0 && req.ServiceType == "hotspot" {
		sharedUsers = 1 // default sesuai router MikroTik
	}
	p := &model.BandwidthProfile{
		DeviceID:            deviceID,
		ServiceType:         req.ServiceType,
		Name:                req.Name,
		MikrotikProfileName: req.MikrotikProfileName,
		RateLimit:           req.RateLimit,
		ParentQueue:         req.ParentQueue,
		LocalAddress:        req.LocalAddress,
		RemoteAddress:       req.RemoteAddress,
		SessionTimeout:      req.SessionTimeout,
		IdleTimeout:         req.IdleTimeout,
		AddressPool:         req.AddressPool,
		SharedUsers:         sharedUsers,
		PriceMonthly:        req.PriceMonthly,
		Description:         req.Description,
		Active:              active,
	}
	if err := h.Store.Create(c.Request.Context(), p); err != nil {
		WriteErr(c, err)
		return
	}
	warning := h.propagateAdd(c, deviceID, *p)
	c.JSON(http.StatusCreated, dto.OK(dto.BandwidthProfileWriteResponse{
		Profile: dto.FromModelBandwidthProfile(*p),
		Warning: warning,
	}))
}

func (h *BandwidthProfiles) Update(c *gin.Context) {
	deviceID, ok := parseDeviceIDForBW(c)
	if !ok {
		return
	}
	id, ok := parseBWProfileID(c)
	if !ok {
		return
	}
	var req dto.BandwidthProfileUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	p, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrBandwidthProfileNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "bandwidth profile not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if p.DeviceID != deviceID {
		c.AbortWithStatusJSON(http.StatusNotFound,
			dto.Err("NOT_FOUND", "bandwidth profile not found for this device", c.Request.URL.Path))
		return
	}
	if req.Name != nil {
		p.Name = *req.Name
	}
	if req.RateLimit != nil {
		p.RateLimit = *req.RateLimit
	}
	if req.ParentQueue != nil {
		p.ParentQueue = *req.ParentQueue
	}
	if req.LocalAddress != nil {
		p.LocalAddress = *req.LocalAddress
	}
	if req.RemoteAddress != nil {
		p.RemoteAddress = *req.RemoteAddress
	}
	if req.SessionTimeout != nil {
		p.SessionTimeout = *req.SessionTimeout
	}
	if req.IdleTimeout != nil {
		p.IdleTimeout = *req.IdleTimeout
	}
	if req.AddressPool != nil {
		p.AddressPool = *req.AddressPool
	}
	if req.SharedUsers != nil {
		p.SharedUsers = *req.SharedUsers
	}
	if req.PriceMonthly != nil {
		p.PriceMonthly = *req.PriceMonthly
	}
	if req.Description != nil {
		p.Description = *req.Description
	}
	if req.Active != nil {
		p.Active = *req.Active
	}
	if err := h.Store.Update(c.Request.Context(), &p); err != nil {
		WriteErr(c, err)
		return
	}
	warning := h.propagateSet(c, deviceID, p)
	WriteOK(c, dto.BandwidthProfileWriteResponse{
		Profile: dto.FromModelBandwidthProfile(p),
		Warning: warning,
	})
}

func (h *BandwidthProfiles) Delete(c *gin.Context) {
	deviceID, ok := parseDeviceIDForBW(c)
	if !ok {
		return
	}
	id, ok := parseBWProfileID(c)
	if !ok {
		return
	}
	p, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrBandwidthProfileNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "bandwidth profile not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if p.DeviceID != deviceID {
		c.AbortWithStatusJSON(http.StatusNotFound,
			dto.Err("NOT_FOUND", "bandwidth profile not found for this device", c.Request.URL.Path))
		return
	}
	if err := h.Store.Delete(c.Request.Context(), id); err != nil {
		if errors.Is(err, store.ErrBandwidthProfileInUse) {
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", "bandwidth profile still referenced by subscription", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	warning := h.propagateRemove(c, deviceID, p)
	if warning != "" {
		WriteOK(c, dto.BandwidthProfileWriteResponse{Warning: warning})
		return
	}
	WriteNoContent(c)
}

// Sync — POST /devices/:device_id/bandwidth-profiles/sync.
//
// Tarik semua PPP profile + Hotspot user profile dari router → upsert ke DB.
//   - Router profile yang sudah ada di DB → masuk Synced[] (field operator
//     dipertahankan: price_monthly, description, active TIDAK ditimpa).
//   - Router profile baru → insert dengan default price=0, active=true,
//     masuk Created[].
//   - DB profile yang sudah hilang dari router → masuk Orphan[]. Tidak
//     di-hapus otomatis (operator decide via DELETE).
//
// Butuh device online. Return 503 kalau router unreachable.
func (h *BandwidthProfiles) Sync(c *gin.Context) {
	deviceID, ok := parseDeviceIDForBW(c)
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

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	pppProfiles, err := cs.PPP.ProfileList(ctx)
	if err != nil {
		WriteErr(c, fmt.Errorf("list ppp profiles: %w", err))
		return
	}
	hotProfiles, err := cs.Hot.ProfileList(ctx)
	if err != nil {
		WriteErr(c, fmt.Errorf("list hotspot profiles: %w", err))
		return
	}

	// Build router profile key set untuk orphan detection.
	routerKeys := make(map[string]struct{}, len(pppProfiles)+len(hotProfiles))
	res := dto.BandwidthProfileSyncResponse{
		Synced:  []string{},
		Created: []string{},
		Orphan:  []string{},
		Skipped: []string{},
	}

	for _, rp := range pppProfiles {
		key := "pppoe/" + rp.Name
		routerKeys[key] = struct{}{}
		// Upsert: kalau sudah ada di DB → preserve operator fields.
		if _, errGet := h.Store.GetByMikrotikName(ctx, deviceID, "pppoe", rp.Name); errGet == nil {
			res.Synced = append(res.Synced, key)
			continue
		}
		newP := &model.BandwidthProfile{
			DeviceID:            deviceID,
			ServiceType:         "pppoe",
			Name:                rp.Name,
			MikrotikProfileName: rp.Name,
			RateLimit:           rp.RateLimit,
			LocalAddress:        rp.LocalAddr,
			RemoteAddress:       rp.RemoteAddr,
			SessionTimeout:      rp.SessionTimeout,
			IdleTimeout:         rp.IdleTimeout,
			ParentQueue:         rp.ParentQueue,
			SharedUsers:         1, // default — tidak dipakai untuk pppoe
			PriceMonthly:        0,
			Active:              true,
		}
		if err := h.Store.Create(ctx, newP); err != nil {
			h.Log.WithError(err).WithField("profile", rp.Name).
				Warn("bandwidth_profile: sync insert failed")
			continue
		}
		res.Created = append(res.Created, key)
	}

	for _, rp := range hotProfiles {
		key := "hotspot/" + rp.Name
		// Skip profiles owned by profile_config (voucher).
		if hasTag(rp.Comment, TagVC) {
			res.Skipped = append(res.Skipped, key+" (voucher)")
			continue
		}
		routerKeys[key] = struct{}{}
		if _, errGet := h.Store.GetByMikrotikName(ctx, deviceID, "hotspot", rp.Name); errGet == nil {
			res.Synced = append(res.Synced, key)
			continue
		}
		shared := rp.SharedUsers
		if shared <= 0 {
			shared = 1
		}
		newP := &model.BandwidthProfile{
			DeviceID:            deviceID,
			ServiceType:         "hotspot",
			Name:                rp.Name,
			MikrotikProfileName: rp.Name,
			RateLimit:           rp.RateLimit,
			AddressPool:         rp.AddressPool,
			SharedUsers:         shared,
			ParentQueue:         rp.ParentQueue,
			PriceMonthly:        0,
			Active:              true,
		}
		if err := h.Store.Create(ctx, newP); err != nil {
			h.Log.WithError(err).WithField("profile", rp.Name).
				Warn("bandwidth_profile: sync insert failed")
			continue
		}
		res.Created = append(res.Created, key)
		// Best-effort: claim ownership marker on router.
		if !hasTag(rp.Comment, TagBW) {
			claimComment := commentBW(*newP)
			_ = cs.Hot.ProfileSet(ctx, hotspot.ProfileSetArgs{
				ID:      rp.ID,
				Comment: &claimComment,
			})
		}
	}

	// Orphan detection: ambil semua DB profile untuk device ini, cek mana yang
	// tidak ada di routerKeys.
	dbProfiles, err := h.Store.ListByDevice(ctx, deviceID, store.BandwidthProfileListFilter{})
	if err == nil {
		for _, dp := range dbProfiles {
			key := dp.ServiceType + "/" + dp.MikrotikProfileName
			if _, exists := routerKeys[key]; !exists {
				res.Orphan = append(res.Orphan, key)
			}
		}
	}

	WriteOK(c, res)
}

// ── Propagate helpers ────────────────────────────────────────────────────

// propagateAdd best-effort buat profile di router. Return warning string
// (kosong = sukses, atau MikroTik tidak dipakai).
func (h *BandwidthProfiles) propagateAdd(c *gin.Context, deviceID uint, p model.BandwidthProfile) string {
	cs, ok := h.lookupClient(c, deviceID)
	if !ok {
		return "device offline — profile saved locally only"
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), propagateTimeout)
	defer cancel()

	switch p.ServiceType {
	case "pppoe":
		_, err := cs.PPP.ProfileAdd(ctx, ppp.ProfileAddArgs{
			Name:           p.MikrotikProfileName,
			LocalAddr:      p.LocalAddress,
			RemoteAddr:     p.RemoteAddress,
			RateLimit:      p.RateLimit,
			SessionTimeout: p.SessionTimeout,
			IdleTimeout:    p.IdleTimeout,
			ParentQueue:    p.ParentQueue,
			Comment:        commentBW(p),
		})
		return mapPropagateErr(err, p)
	case "hotspot":
		// OnLogin sengaja kosong — voucher-only, dikelola profile_config
		// + expiry service. Subscription bandwidth_profile tidak boleh
		// overwrite script voucher.
		_, err := cs.Hot.ProfileAdd(ctx, hotspot.ProfileAddArgs{
			Name:        p.MikrotikProfileName,
			AddressPool: p.AddressPool,
			RateLimit:   p.RateLimit,
			SharedUsers: p.SharedUsers,
			ParentQueue: p.ParentQueue,
			Comment:     commentBW(p),
		})
		return mapPropagateErr(err, p)
	default:
		return "unknown service_type: " + p.ServiceType
	}
}

// propagateSet update profile di router. Cari ID via ProfileByName dulu.
func (h *BandwidthProfiles) propagateSet(c *gin.Context, deviceID uint, p model.BandwidthProfile) string {
	cs, ok := h.lookupClient(c, deviceID)
	if !ok {
		return "device offline — profile saved locally only"
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), propagateTimeout)
	defer cancel()

	switch p.ServiceType {
	case "pppoe":
		rp, err := cs.PPP.ProfileByName(ctx, p.MikrotikProfileName)
		if err != nil {
			if errors.Is(err, mikrotik.ErrNotFound) {
				// Tidak ada di router → coba create.
				return h.propagateAdd(c, deviceID, p)
			}
			return mapPropagateErr(err, p)
		}
		setErr := cs.PPP.ProfileSet(ctx, ppp.ProfileSetArgs{
			ID:             rp.ID,
			LocalAddr:      p.LocalAddress,
			RemoteAddr:     p.RemoteAddress,
			RateLimit:      p.RateLimit,
			SessionTimeout: strPtr(p.SessionTimeout),
			IdleTimeout:    strPtr(p.IdleTimeout),
			ParentQueue:    strPtr(p.ParentQueue),
			Comment:        strPtr(commentBW(p)),
		})
		return mapPropagateErr(setErr, p)
	case "hotspot":
		rp, err := cs.Hot.ProfileByName(ctx, p.MikrotikProfileName)
		if err != nil {
			if errors.Is(err, mikrotik.ErrNotFound) {
				return h.propagateAdd(c, deviceID, p)
			}
			return mapPropagateErr(err, p)
		}
		setErr := cs.Hot.ProfileSet(ctx, hotspot.ProfileSetArgs{
			ID:          rp.ID,
			AddressPool: p.AddressPool,
			RateLimit:   p.RateLimit,
			SharedUsers: &p.SharedUsers,
			ParentQueue: p.ParentQueue,
			Comment:     strPtr(commentBW(p)),
		})
		return mapPropagateErr(setErr, p)
	default:
		return "unknown service_type: " + p.ServiceType
	}
}

// propagateRemove hapus profile di router. Idempotent: kalau sudah hilang,
// no-op (warning kosong).
func (h *BandwidthProfiles) propagateRemove(c *gin.Context, deviceID uint, p model.BandwidthProfile) string {
	cs, ok := h.lookupClient(c, deviceID)
	if !ok {
		return "device offline — profile removed from DB only"
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), propagateTimeout)
	defer cancel()

	switch p.ServiceType {
	case "pppoe":
		rp, err := cs.PPP.ProfileByName(ctx, p.MikrotikProfileName)
		if err != nil {
			if errors.Is(err, mikrotik.ErrNotFound) {
				return "" // sudah hilang di router — OK
			}
			return mapPropagateErr(err, p)
		}
		return mapPropagateErr(cs.PPP.ProfileRemove(ctx, rp.ID), p)
	case "hotspot":
		rp, err := cs.Hot.ProfileByName(ctx, p.MikrotikProfileName)
		if err != nil {
			if errors.Is(err, mikrotik.ErrNotFound) {
				return ""
			}
			return mapPropagateErr(err, p)
		}
		return mapPropagateErr(cs.Hot.ProfileRemove(ctx, rp.ID), p)
	default:
		return ""
	}
}

func (h *BandwidthProfiles) lookupClient(c *gin.Context, deviceID uint) (*devmgr.ClientSet, bool) {
	if h.DevMgr == nil {
		return nil, false
	}
	cs, err := h.DevMgr.Get(deviceID)
	if err != nil {
		h.Log.WithError(err).WithField("device_id", deviceID).
			Debug("bandwidth_profile: device offline, skip MikroTik propagate")
		return nil, false
	}
	return cs, true
}

func mapPropagateErr(err error, p model.BandwidthProfile) string {
	if err == nil {
		return ""
	}
	return fmt.Sprintf("%s/%s: %s", p.ServiceType, p.MikrotikProfileName, err.Error())
}

const (
	TagBW = "rosmon:bw"
	TagVC = "rosmon:vc"
)

func hasTag(comment, tag string) bool {
	return comment == tag ||
		strings.HasPrefix(comment, tag+" ") ||
		strings.HasPrefix(comment, tag+"|")
}

func commentBW(p model.BandwidthProfile) string {
	if p.Description != "" {
		return TagBW + " | " + p.Description
	}
	return TagBW
}

func strPtr(s string) *string { return &s }

func parseDeviceIDForBW(c *gin.Context) (uint, bool) {
	raw := c.Param("device_id")
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ID", "invalid device id", raw))
		return 0, false
	}
	return uint(n), true
}

func parseBWProfileID(c *gin.Context) (uint, bool) {
	raw := c.Param("id")
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ID", "invalid bandwidth profile id", raw))
		return 0, false
	}
	return uint(n), true
}
