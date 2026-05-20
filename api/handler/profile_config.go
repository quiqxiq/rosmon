package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/roslib-mikhmon/api/dto"
	"github.com/quiqxiq/roslib-mikhmon/internal/rosfmt"
	"github.com/quiqxiq/roslib-mikhmon/store"
	"github.com/quiqxiq/roslib-mikhmon/store/model"
)

// ProfileConfig handler untuk endpoint /devices/{device_id}/hotspot/profile-configs.
//
// Tidak memerlukan koneksi RouterOS — config ini lokal di postgres (terpisah
// dari profile router-side, lihat docstring HotspotProfileConfig).
type ProfileConfig struct {
	Store store.ProfileConfigStore
}

// NewProfileConfig constructor.
func NewProfileConfig(s store.ProfileConfigStore) *ProfileConfig {
	return &ProfileConfig{Store: s}
}

// Register mount endpoint di group `dev` (sudah ada :device_id di parent).
//
// PENTING: dipasang di scope yang TIDAK pakai DeviceMiddleware
// (lookup di-handle handler sendiri pakai DeviceStore), karena config
// tetap dapat di-baca/edit meski router offline.
func (h *ProfileConfig) Register(dev *gin.RouterGroup) {
	g := dev.Group("/hotspot/profile-configs")
	g.GET("", h.List)
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
