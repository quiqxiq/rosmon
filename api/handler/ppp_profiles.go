package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/mikrotik"
	"github.com/quiqxiq/rosmon/mikrotik/ppp"
	"github.com/quiqxiq/rosmon/service/devmgr"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
)

// PPPProfiles — DB-backed management for /devices/:device_id/ppp-profiles.
// Maps to RouterOS /ppp/profile. One DB record per router profile.
// Sync endpoint discovers profiles from router without overwriting billing fields.
type PPPProfiles struct {
	Store  store.PPPProfileStore
	DevMgr *devmgr.Manager
	Log    *logrus.Logger
}

func NewPPPProfiles(s store.PPPProfileStore, devMgr *devmgr.Manager, log *logrus.Logger) *PPPProfiles {
	if log == nil {
		log = logrus.New()
	}
	return &PPPProfiles{Store: s, DevMgr: devMgr, Log: log}
}

func (h *PPPProfiles) Register(dev *gin.RouterGroup) {
	g := dev.Group("/ppp-profiles")
	g.GET("", h.List)
	g.POST("", h.Create)
	g.POST("/sync", h.Sync)
	g.GET("/:id", h.Get)
	g.PUT("/:id", h.Update)
	g.DELETE("/:id", h.Delete)
}

func (h *PPPProfiles) List(c *gin.Context) {
	deviceID, ok := parsePPPProfilesDeviceID(c)
	if !ok {
		return
	}
	items, err := h.Store.ListByDevice(c.Request.Context(), deviceID)
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.PPPProfileResponse, len(items))
	for i, it := range items {
		out[i] = dto.FromModelPPPProfile(it)
	}
	WriteList(c, out, len(out))
}

func (h *PPPProfiles) Get(c *gin.Context) {
	deviceID, ok := parsePPPProfilesDeviceID(c)
	if !ok {
		return
	}
	id, ok := parsePPPProfileID(c)
	if !ok {
		return
	}
	p, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrPPPProfileNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "ppp profile not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if p.DeviceID != deviceID {
		c.AbortWithStatusJSON(http.StatusNotFound,
			dto.Err("NOT_FOUND", "ppp profile not found for this device", c.Request.URL.Path))
		return
	}
	WriteOK(c, dto.FromModelPPPProfile(p))
}

func (h *PPPProfiles) Create(c *gin.Context) {
	deviceID, ok := parsePPPProfilesDeviceID(c)
	if !ok {
		return
	}
	var req dto.PPPProfileCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	active := true
	if req.Active != nil {
		active = *req.Active
	}
	isPublic := false
	if req.IsPublic != nil {
		isPublic = *req.IsPublic
	}
	p := &model.PPPProfile{
		DeviceID:       deviceID,
		Name:           req.Name,
		RateLimit:      req.RateLimit,
		LocalAddress:   req.LocalAddress,
		RemoteAddress:  req.RemoteAddress,
		SessionTimeout: req.SessionTimeout,
		IdleTimeout:    req.IdleTimeout,
		ParentQueue:    req.ParentQueue,
		PriceMonthly:   req.PriceMonthly,
		Description:    req.Description,
		Active:         active,
		IsPublic:       isPublic,
	}
	if err := h.Store.Create(c.Request.Context(), p); err != nil {
		WriteErr(c, err)
		return
	}
	warning := h.propagateAdd(c, deviceID, *p)
	c.JSON(http.StatusCreated, dto.OK(dto.PPPProfileWriteResponse{
		Profile: dto.FromModelPPPProfile(*p),
		Warning: warning,
	}))
}

func (h *PPPProfiles) Update(c *gin.Context) {
	deviceID, ok := parsePPPProfilesDeviceID(c)
	if !ok {
		return
	}
	id, ok := parsePPPProfileID(c)
	if !ok {
		return
	}
	var req dto.PPPProfileUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	p, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrPPPProfileNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "ppp profile not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if p.DeviceID != deviceID {
		c.AbortWithStatusJSON(http.StatusNotFound,
			dto.Err("NOT_FOUND", "ppp profile not found for this device", c.Request.URL.Path))
		return
	}
	if req.Name != nil {
		p.Name = *req.Name
	}
	if req.RateLimit != nil {
		p.RateLimit = *req.RateLimit
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
	if req.ParentQueue != nil {
		p.ParentQueue = *req.ParentQueue
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
	if req.IsPublic != nil {
		p.IsPublic = *req.IsPublic
	}
	if err := h.Store.Update(c.Request.Context(), &p); err != nil {
		WriteErr(c, err)
		return
	}
	warning := h.propagateSet(c, deviceID, p)
	WriteOK(c, dto.PPPProfileWriteResponse{
		Profile: dto.FromModelPPPProfile(p),
		Warning: warning,
	})
}

func (h *PPPProfiles) Delete(c *gin.Context) {
	deviceID, ok := parsePPPProfilesDeviceID(c)
	if !ok {
		return
	}
	id, ok := parsePPPProfileID(c)
	if !ok {
		return
	}
	p, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrPPPProfileNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "ppp profile not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if p.DeviceID != deviceID {
		c.AbortWithStatusJSON(http.StatusNotFound,
			dto.Err("NOT_FOUND", "ppp profile not found for this device", c.Request.URL.Path))
		return
	}
	if err := h.Store.Delete(c.Request.Context(), id); err != nil {
		if errors.Is(err, store.ErrPPPProfileInUse) {
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", "ppp profile still referenced by subscription", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	warning := h.propagateRemove(c, deviceID, p)
	if warning != "" {
		WriteOK(c, dto.PPPProfileWriteResponse{Warning: warning})
		return
	}
	WriteNoContent(c)
}

// Sync — POST /devices/:device_id/ppp-profiles/sync
// Fetches /ppp/profile from router → upserts to DB.
// Preserves operator fields (price_monthly, description) on existing records.
func (h *PPPProfiles) Sync(c *gin.Context) {
	deviceID, ok := parsePPPProfilesDeviceID(c)
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

	routerProfiles, err := cs.PPP.ProfileList(ctx)
	if err != nil {
		WriteErr(c, fmt.Errorf("list ppp profiles: %w", err))
		return
	}

	res := dto.PPPProfileSyncResponse{
		Synced:  []string{},
		Created: []string{},
		Orphan:  []string{},
	}

	routerNames := make(map[string]struct{}, len(routerProfiles))
	for _, rp := range routerProfiles {
		if rp.Name == "" {
			continue
		}
		if isSystemProfile(rp.Name) {
			continue
		}
		routerNames[rp.Name] = struct{}{}
		newP := &model.PPPProfile{
			DeviceID:       deviceID,
			Name:           rp.Name,
			RateLimit:      rp.RateLimit,
			LocalAddress:   rp.LocalAddr,
			RemoteAddress:  rp.RemoteAddr,
			SessionTimeout: rp.SessionTimeout,
			IdleTimeout:    rp.IdleTimeout,
			ParentQueue:    rp.ParentQueue,
			Active:         !rp.Disabled,
		}
		created, err := h.Store.Upsert(ctx, newP)
		if err != nil {
			h.Log.WithError(err).WithField("profile", rp.Name).Warn("ppp_profiles: sync upsert failed")
			continue
		}
		if created {
			res.Created = append(res.Created, rp.Name)
		} else {
			res.Synced = append(res.Synced, rp.Name)
		}
	}

	// Orphan detection.
	dbProfiles, err := h.Store.ListByDevice(ctx, deviceID)
	if err == nil {
		for _, dp := range dbProfiles {
			if _, exists := routerNames[dp.Name]; !exists {
				res.Orphan = append(res.Orphan, dp.Name)
			}
		}
	}

	WriteOK(c, res)
}

// ── Propagate helpers ────────────────────────────────────────────────────

func (h *PPPProfiles) propagateAdd(c *gin.Context, deviceID uint, p model.PPPProfile) string {
	cs, ok := h.lookupPPPClient(c, deviceID)
	if !ok {
		return "device offline — profile saved locally only"
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), propagateTimeout)
	defer cancel()
	_, err := cs.PPP.ProfileAdd(ctx, ppp.ProfileAddArgs{
		Name:           p.Name,
		RateLimit:      p.RateLimit,
		LocalAddr:      p.LocalAddress,
		RemoteAddr:     p.RemoteAddress,
		SessionTimeout: p.SessionTimeout,
		IdleTimeout:    p.IdleTimeout,
		ParentQueue:    p.ParentQueue,
	})
	return mapPPPProfileErr(err, p)
}

func (h *PPPProfiles) propagateSet(c *gin.Context, deviceID uint, p model.PPPProfile) string {
	cs, ok := h.lookupPPPClient(c, deviceID)
	if !ok {
		return "device offline — profile saved locally only"
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), propagateTimeout)
	defer cancel()
	rp, err := cs.PPP.ProfileByName(ctx, p.Name)
	if err != nil {
		if errors.Is(err, mikrotik.ErrNotFound) {
			return h.propagateAdd(c, deviceID, p)
		}
		return mapPPPProfileErr(err, p)
	}
	sessionTimeout := p.SessionTimeout
	idleTimeout := p.IdleTimeout
	parentQueue := p.ParentQueue
	return mapPPPProfileErr(cs.PPP.ProfileSet(ctx, ppp.ProfileSetArgs{
		ID:             rp.ID,
		RateLimit:      p.RateLimit,
		LocalAddr:      p.LocalAddress,
		RemoteAddr:     p.RemoteAddress,
		SessionTimeout: &sessionTimeout,
		IdleTimeout:    &idleTimeout,
		ParentQueue:    &parentQueue,
	}), p)
}

func (h *PPPProfiles) propagateRemove(c *gin.Context, deviceID uint, p model.PPPProfile) string {
	cs, ok := h.lookupPPPClient(c, deviceID)
	if !ok {
		return "device offline — profile removed from DB only"
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), propagateTimeout)
	defer cancel()
	rp, err := cs.PPP.ProfileByName(ctx, p.Name)
	if err != nil {
		if errors.Is(err, mikrotik.ErrNotFound) {
			return ""
		}
		return mapPPPProfileErr(err, p)
	}
	return mapPPPProfileErr(cs.PPP.ProfileRemove(ctx, rp.ID), p)
}

func (h *PPPProfiles) lookupPPPClient(c *gin.Context, deviceID uint) (*devmgr.ClientSet, bool) {
	if h.DevMgr == nil {
		return nil, false
	}
	cs, err := h.DevMgr.Get(deviceID)
	if err != nil {
		h.Log.WithError(err).WithField("device_id", deviceID).
			Debug("ppp_profiles: device offline, skip MikroTik propagate")
		return nil, false
	}
	return cs, true
}

func mapPPPProfileErr(err error, p model.PPPProfile) string {
	if err == nil {
		return ""
	}
	return fmt.Sprintf("ppp/%s: %s", p.Name, err.Error())
}

func parsePPPProfilesDeviceID(c *gin.Context) (uint, bool) {
	raw := c.Param("device_id")
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ID", "invalid device id", raw))
		return 0, false
	}
	return uint(n), true
}

func parsePPPProfileID(c *gin.Context) (uint, bool) {
	raw := c.Param("id")
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ID", "invalid ppp profile id", raw))
		return 0, false
	}
	return uint(n), true
}
