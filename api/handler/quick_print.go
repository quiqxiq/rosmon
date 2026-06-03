package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/store"
	"github.com/sirupsen/logrus"
)

// QuickPrint — DB-backed CRUD untuk preset Quick Print voucher,
// /devices/:device_id/quick-print. Menggantikan penyimpanan di RouterOS
// /system/script. Wire format string-persis dengan frontend
// (web/src/features/voucher/print/api/schema.ts).
type QuickPrint struct {
	Store store.QuickPrintStore
	Log   *logrus.Logger
}

func NewQuickPrint(s store.QuickPrintStore, log *logrus.Logger) *QuickPrint {
	if log == nil {
		log = logrus.New()
	}
	return &QuickPrint{Store: s, Log: log}
}

func (h *QuickPrint) Register(dev *gin.RouterGroup) {
	g := dev.Group("/quick-print")
	g.GET("", h.List)
	g.POST("", h.Create)
	g.GET("/:name", h.Get)
	g.PUT("/:name", h.Update)
	g.DELETE("/:name", h.Delete)
}

func (h *QuickPrint) List(c *gin.Context) {
	deviceID, ok := parseQuickPrintDeviceID(c)
	if !ok {
		return
	}
	items, err := h.Store.ListByDevice(c.Request.Context(), deviceID)
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.QuickPrintPackageDTO, len(items))
	for i, it := range items {
		out[i] = dto.FromModelQuickPrint(it)
	}
	WriteOK(c, out)
}

func (h *QuickPrint) Get(c *gin.Context) {
	deviceID, ok := parseQuickPrintDeviceID(c)
	if !ok {
		return
	}
	p, err := h.Store.GetByName(c.Request.Context(), deviceID, c.Param("name"))
	if err != nil {
		if errors.Is(err, store.ErrQuickPrintNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "quick print package not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelQuickPrint(p))
}

func (h *QuickPrint) Create(c *gin.Context) {
	deviceID, ok := parseQuickPrintDeviceID(c)
	if !ok {
		return
	}
	var req dto.QuickPrintPackageDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	m := req.ToModel(deviceID)
	if _, err := h.Store.Upsert(c.Request.Context(), &m); err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, gin.H{"message": "quick print package saved"})
}

func (h *QuickPrint) Update(c *gin.Context) {
	deviceID, ok := parseQuickPrintDeviceID(c)
	if !ok {
		return
	}
	pathName := c.Param("name")
	var req dto.QuickPrintPackageDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	existing, err := h.Store.GetByName(c.Request.Context(), deviceID, pathName)
	if err != nil {
		if errors.Is(err, store.ErrQuickPrintNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "quick print package not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	// Path segment adalah identitas; body.name boleh berbeda (rename).
	m := req.ToModel(deviceID)
	m.ID = existing.ID
	m.CreatedAt = existing.CreatedAt
	if err := h.Store.Update(c.Request.Context(), &m); err != nil {
		if store.IsUniqueViolation(err) {
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", "nama preset sudah dipakai di router ini", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, gin.H{"message": "quick print package updated"})
}

func (h *QuickPrint) Delete(c *gin.Context) {
	deviceID, ok := parseQuickPrintDeviceID(c)
	if !ok {
		return
	}
	if err := h.Store.DeleteByName(c.Request.Context(), deviceID, c.Param("name")); err != nil {
		if errors.Is(err, store.ErrQuickPrintNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "quick print package not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func parseQuickPrintDeviceID(c *gin.Context) (uint, bool) {
	raw := c.Param("device_id")
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ID", "invalid device id", raw))
		return 0, false
	}
	return uint(n), true
}
