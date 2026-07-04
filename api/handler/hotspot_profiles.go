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
	"github.com/quiqxiq/rosmon/internal/rosfmt"
	"github.com/quiqxiq/rosmon/mikrotik"
	"github.com/quiqxiq/rosmon/mikrotik/hotspot"
	"github.com/quiqxiq/rosmon/service/devmgr"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/quiqxiq/rosmon/workflows"
	"github.com/sirupsen/logrus"
)

// HotspotProfiles — DB-backed management for /devices/:device_id/hotspot-profiles.
// Maps to RouterOS /ip/hotspot/user/profile. Supports two roles:
//   - permanent: monthly billing customers (replaces bandwidth_profiles service_type=hotspot)
//   - voucher: expiry-based access (replaces hotspot_profile_configs)
//
// Sync endpoint uses ?role= query param to tag newly discovered profiles.
// Existing DB records always preserve their role (DoUpdates excludes role column).
type HotspotProfiles struct {
	Store        store.HotspotProfileStore
	DevMgr       *devmgr.Manager
	GoServiceURL string
	Log          *logrus.Logger
}

func NewHotspotProfiles(s store.HotspotProfileStore, devMgr *devmgr.Manager, goServiceURL string, log *logrus.Logger) *HotspotProfiles {
	if log == nil {
		log = logrus.New()
	}
	return &HotspotProfiles{Store: s, DevMgr: devMgr, GoServiceURL: goServiceURL, Log: log}
}

func (h *HotspotProfiles) Register(dev *gin.RouterGroup) {
	g := dev.Group("/hotspot-profiles")
	g.GET("", h.List)
	g.POST("", h.Create)
	g.POST("/sync", h.Sync)
	g.GET("/:id", h.Get)
	g.PUT("/:id", h.Update)
	g.DELETE("/:id", h.Delete)
}

func (h *HotspotProfiles) List(c *gin.Context) {
	deviceID, ok := parseHotspotProfilesDeviceID(c)
	if !ok {
		return
	}
	f := store.HotspotProfileListFilter{
		Role:       c.Query("role"),
		OnlyActive: c.Query("only_active") == "true",
	}
	items, err := h.Store.ListByDevice(c.Request.Context(), deviceID, f)
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.HotspotProfileResponse, len(items))
	for i, it := range items {
		out[i] = dto.FromModelHotspotProfile(it)
	}
	WriteList(c, out, len(out))
}

func (h *HotspotProfiles) Get(c *gin.Context) {
	deviceID, ok := parseHotspotProfilesDeviceID(c)
	if !ok {
		return
	}
	id, ok := parseHotspotProfilesID(c)
	if !ok {
		return
	}
	p, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrHotspotProfileNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "hotspot profile not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if p.DeviceID != deviceID {
		c.AbortWithStatusJSON(http.StatusNotFound,
			dto.Err("NOT_FOUND", "hotspot profile not found for this device", c.Request.URL.Path))
		return
	}
	WriteOK(c, dto.FromModelHotspotProfile(p))
}

func (h *HotspotProfiles) Create(c *gin.Context) {
	deviceID, ok := parseHotspotProfilesDeviceID(c)
	if !ok {
		return
	}
	var req dto.HotspotProfileCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}

	// Normalize validity for voucher profiles.
	validity := req.Validity
	if req.Role == "voucher" && validity != "" {
		normalized, err := rosfmt.NormalizeDuration(validity)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest,
				dto.ErrDetails("VALIDATION", "invalid validity format",
					c.Request.URL.Path, err.Error()))
			return
		}
		validity = normalized
	}

	active := true
	if req.Active != nil {
		active = *req.Active
	}
	expiryMode := req.ExpiryMode
	if expiryMode == "" {
		expiryMode = "0"
	}
	sharedUsers := req.SharedUsers
	if sharedUsers <= 0 {
		sharedUsers = 1
	}
	statusAutorefresh := req.StatusAutorefresh
	if statusAutorefresh == "" {
		statusAutorefresh = "1m"
	}

	p := &model.HotspotProfile{
		DeviceID:          deviceID,
		Name:              req.Name,
		Role:              req.Role,
		RateLimit:         req.RateLimit,
		AddressPool:       req.AddressPool,
		SharedUsers:       sharedUsers,
		StatusAutorefresh: statusAutorefresh,
		ParentQueue:       req.ParentQueue,
		PriceMonthly:      req.PriceMonthly,
		ExpiryMode:        expiryMode,
		Validity:          validity,
		Price:             req.Price,
		SellPrice:         req.SellPrice,
		LockMAC:           req.LockMAC,
		Description:       req.Description,
		Active:            active,
		IsPublic:          req.IsPublic != nil && *req.IsPublic,
	}
	if err := h.Store.Create(c.Request.Context(), p); err != nil {
		if store.IsUniqueViolation(err) {
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", "profile name already exists on this device", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	warning := h.propagateAdd(c, deviceID, *p)
	if p.Role == "voucher" {
		h.tryInjectOnLogin(c, deviceID, *p)
	}
	c.JSON(http.StatusCreated, dto.OK(dto.HotspotProfileWriteResponse{
		Profile: dto.FromModelHotspotProfile(*p),
		Warning: warning,
	}))
}

func (h *HotspotProfiles) Update(c *gin.Context) {
	deviceID, ok := parseHotspotProfilesDeviceID(c)
	if !ok {
		return
	}
	id, ok := parseHotspotProfilesID(c)
	if !ok {
		return
	}
	var req dto.HotspotProfileUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	p, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrHotspotProfileNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "hotspot profile not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if p.DeviceID != deviceID {
		c.AbortWithStatusJSON(http.StatusNotFound,
			dto.Err("NOT_FOUND", "hotspot profile not found for this device", c.Request.URL.Path))
		return
	}

	if req.Name != nil {
		p.Name = *req.Name
	}
	if req.RateLimit != nil {
		p.RateLimit = *req.RateLimit
	}
	if req.AddressPool != nil {
		p.AddressPool = *req.AddressPool
	}
	if req.SharedUsers != nil {
		p.SharedUsers = *req.SharedUsers
	}
	if req.StatusAutorefresh != nil {
		p.StatusAutorefresh = *req.StatusAutorefresh
	}
	if req.ParentQueue != nil {
		p.ParentQueue = *req.ParentQueue
	}
	if req.PriceMonthly != nil {
		p.PriceMonthly = *req.PriceMonthly
	}
	if req.ExpiryMode != nil {
		p.ExpiryMode = *req.ExpiryMode
	}
	if req.Validity != nil {
		normalized, err := rosfmt.NormalizeDuration(*req.Validity)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusBadRequest,
				dto.ErrDetails("VALIDATION", "invalid validity format",
					c.Request.URL.Path, err.Error()))
			return
		}
		p.Validity = normalized
	}
	if req.Price != nil {
		p.Price = *req.Price
	}
	if req.SellPrice != nil {
		p.SellPrice = *req.SellPrice
	}
	if req.LockMAC != nil {
		p.LockMAC = *req.LockMAC
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

	// Propagate fields to RouterOS (rate_limit, shared_users, etc).
	warning := h.propagateSet(c, deviceID, p)

	// Best-effort inject on-login for voucher profiles.
	if p.Role == "voucher" {
		h.tryInjectOnLogin(c, deviceID, p)
	}

	if warning != "" {
		WriteOK(c, dto.HotspotProfileWriteResponse{
			Profile: dto.FromModelHotspotProfile(p),
			Warning: warning,
		})
		return
	}
	WriteOK(c, dto.HotspotProfileWriteResponse{
		Profile: dto.FromModelHotspotProfile(p),
	})
}

func (h *HotspotProfiles) Delete(c *gin.Context) {
	deviceID, ok := parseHotspotProfilesDeviceID(c)
	if !ok {
		return
	}
	id, ok := parseHotspotProfilesID(c)
	if !ok {
		return
	}
	p, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrHotspotProfileNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "hotspot profile not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if p.DeviceID != deviceID {
		c.AbortWithStatusJSON(http.StatusNotFound,
			dto.Err("NOT_FOUND", "hotspot profile not found for this device", c.Request.URL.Path))
		return
	}
	if err := h.Store.Delete(c.Request.Context(), id); err != nil {
		if errors.Is(err, store.ErrHotspotProfileInUse) {
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", "hotspot profile still referenced by subscription", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

// Sync — POST /devices/:device_id/hotspot-profiles/sync?role=permanent|voucher
// Fetches /ip/hotspot/user/profile from router → upserts to DB.
// role query param sets the role for newly inserted records only.
// Existing DB records preserve their role.
func (h *HotspotProfiles) Sync(c *gin.Context) {
	deviceID, ok := parseHotspotProfilesDeviceID(c)
	if !ok {
		return
	}
	role := c.DefaultQuery("role", "permanent")
	if role != "permanent" && role != "voucher" {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ARGUMENT", "role must be 'permanent' or 'voucher'", c.Request.URL.Path))
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

	routerProfiles, err := cs.Hot.ProfileList(ctx)
	if err != nil {
		WriteErr(c, fmt.Errorf("list hotspot profiles: %w", err))
		return
	}

	res := dto.HotspotProfileSyncResponse{
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
		newP := &model.HotspotProfile{
			DeviceID:          deviceID,
			Name:              rp.Name,
			Role:              role,
			RateLimit:         rp.RateLimit,
			AddressPool:       rp.AddressPool,
			SharedUsers:       rp.SharedUsers,
			StatusAutorefresh: rp.StatusAutorefresh,
			ParentQueue:       rp.ParentQueue,
			Active:            true,
		}
		if role == "voucher" {
			newP.ExpiryMode = "remc"
			newP.SharedUsers = 1
		}
		created, err := h.Store.Upsert(ctx, newP)
		if err != nil {
			h.Log.WithError(err).WithField("profile", rp.Name).Warn("hotspot_profiles: sync upsert failed")
			continue
		}
		if created {
			res.Created = append(res.Created, rp.Name)
		} else {
			res.Synced = append(res.Synced, rp.Name)
		}
	}

	// Orphan detection (only for the synced role).
	dbProfiles, err := h.Store.ListByDevice(ctx, deviceID, store.HotspotProfileListFilter{Role: role})
	if err == nil {
		for _, dp := range dbProfiles {
			if _, exists := routerNames[dp.Name]; !exists {
				res.Orphan = append(res.Orphan, dp.Name)
			}
		}
	}

	// Best-effort inject on-login scripts for voucher profiles that have expiry mode set.
	if role == "voucher" {
		allVoucher, err := h.Store.ListByDevice(ctx, deviceID, store.HotspotProfileListFilter{Role: "voucher"})
		if err == nil {
			for _, p := range allVoucher {
				if p.ExpiryMode != "0" {
					h.tryInjectOnLogin(c, deviceID, p)
				}
			}
		}
	}

	WriteOK(c, res)
}

// tryInjectOnLogin best-effort push on-login script for a voucher profile.
func (h *HotspotProfiles) tryInjectOnLogin(c *gin.Context, deviceID uint, p model.HotspotProfile) {
	if h.DevMgr == nil {
		return
	}
	cs, err := h.DevMgr.Get(deviceID)
	if err != nil {
		h.Log.WithError(err).WithField("profile", p.Name).
			Debug("hotspot_profiles: skip auto-inject (device offline)")
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
			Warn("hotspot_profiles: auto-inject on-login failed (config saved)")
	}
}

func (h *HotspotProfiles) propagateAdd(c *gin.Context, deviceID uint, p model.HotspotProfile) string {
	cs, ok := h.lookupHotspotClient(c, deviceID)
	if !ok {
		return "device offline — profile saved locally only"
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), propagateTimeout)
	defer cancel()
	sharedUsersStr := mikrotik.Itoa(int64(p.SharedUsers))
	if p.SharedUsers == 0 {
		sharedUsersStr = "unlimited"
	}
	_, err := cs.Hot.ProfileAdd(ctx, hotspot.ProfileAddArgs{
		Name:              p.Name,
		RateLimit:         p.RateLimit,
		AddressPool:       p.AddressPool,
		SharedUsers:       sharedUsersStr,
		StatusAutorefresh: p.StatusAutorefresh,
		ParentQueue:       p.ParentQueue,
	})
	return mapHotspotProfileErr(err, p)
}

func (h *HotspotProfiles) propagateSet(c *gin.Context, deviceID uint, p model.HotspotProfile) string {
	cs, ok := h.lookupHotspotClient(c, deviceID)
	if !ok {
		return "device offline — profile saved locally only"
	}
	ctx, cancel := context.WithTimeout(c.Request.Context(), propagateTimeout)
	defer cancel()
	rp, err := cs.Hot.ProfileByName(ctx, p.Name)
	if err != nil {
		if errors.Is(err, mikrotik.ErrNotFound) {
			return h.propagateAdd(c, deviceID, p)
		}
		return mapHotspotProfileErr(err, p)
	}
	sharedUsersStr := mikrotik.Itoa(int64(p.SharedUsers))
	if p.SharedUsers == 0 {
		sharedUsersStr = "unlimited"
	}
	return mapHotspotProfileErr(cs.Hot.ProfileSet(ctx, hotspot.ProfileSetArgs{
		ID:                rp.ID,
		RateLimit:         p.RateLimit,
		AddressPool:       p.AddressPool,
		SharedUsers:       &sharedUsersStr,
		StatusAutorefresh: p.StatusAutorefresh,
		ParentQueue:       p.ParentQueue,
	}), p)
}

func (h *HotspotProfiles) lookupHotspotClient(c *gin.Context, deviceID uint) (*devmgr.ClientSet, bool) {
	if h.DevMgr == nil {
		return nil, false
	}
	cs, err := h.DevMgr.Get(deviceID)
	if err != nil {
		h.Log.WithError(err).WithField("device_id", deviceID).
			Debug("hotspot_profiles: device offline, skip MikroTik propagate")
		return nil, false
	}
	return cs, true
}

func mapHotspotProfileErr(err error, p model.HotspotProfile) string {
	if err == nil {
		return ""
	}
	return fmt.Sprintf("hotspot/%s: %s", p.Name, err.Error())
}

func parseHotspotProfilesDeviceID(c *gin.Context) (uint, bool) {
	raw := c.Param("device_id")
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ID", "invalid device id", raw))
		return 0, false
	}
	return uint(n), true
}

func parseHotspotProfilesID(c *gin.Context) (uint, bool) {
	raw := c.Param("id")
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ID", "invalid hotspot profile id", raw))
		return 0, false
	}
	return uint(n), true
}
