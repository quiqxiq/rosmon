package handler

import (
	"context"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/service/devmgr"
	"github.com/quiqxiq/rosmon/store"
)

type Devices struct {
	Store  store.DeviceStore
	DevMgr *devmgr.Manager
}

func NewDevices(s store.DeviceStore, mgr *devmgr.Manager) *Devices {
	return &Devices{Store: s, DevMgr: mgr}
}

func (h *Devices) Register(g *gin.RouterGroup) {
	d := g.Group("/devices")
	d.GET("", h.List)
	d.POST("", h.Create)
	d.GET("/:device_id", h.Get)
	d.PUT("/:device_id", h.Update)
	d.DELETE("/:device_id", h.Delete)
}

// RegisterSplit memisahkan read endpoints (readGroup) dan write endpoints
// (writeGroup) untuk memungkinkan role-based access control yang granular.
// readGroup  → GET /devices, GET /devices/:id  (semua authenticated user)
// writeGroup → POST, PUT, DELETE /devices      (admin only)
func (h *Devices) RegisterSplit(readGroup, writeGroup *gin.RouterGroup) {
	r := readGroup.Group("/devices")
	r.GET("", h.List)
	r.GET("/:device_id", h.Get)

	w := writeGroup.Group("/devices")
	w.POST("", h.Create)
	w.PUT("/:device_id", h.Update)
	w.DELETE("/:device_id", h.Delete)
}

func (h *Devices) List(c *gin.Context) {
	// Pakai ListAll supaya operator bisa lihat device inactive juga.
	// Bootstrap service (devmgr.Start dst) tetap pakai List() yang filter active=true.
	devs, err := h.Store.ListAll(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.DeviceResponse, len(devs))
	for i, d := range devs {
		out[i] = dto.FromModelDevice(d)
	}
	WriteList(c, out, len(out))
}

func (h *Devices) Get(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Err("INVALID_ID", "invalid device id", c.Param("device_id")))
		return
	}
	d, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelDevice(d))
}

func (h *Devices) Create(c *gin.Context) {
	var req dto.DeviceCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	d := req.ToModel()
	if err := h.Store.Create(c.Request.Context(), &d); err != nil {
		if store.IsUniqueViolation(err) {
			c.JSON(http.StatusConflict, dto.Err("DUPLICATE_DEVICE", "a device with this host and port already exists", ""))
			return
		}
		WriteErr(c, err)
		return
	}
	// Terhubung ke device setelah dibuat
	if err := h.DevMgr.Add(c.Request.Context(), d); err != nil {
		// Koneksi gagal tapi record sudah tersimpan — kembalikan data + warning
		c.JSON(http.StatusCreated, dto.OK(dto.DeviceWriteResponse{
			Device:  dto.FromModelDevice(d),
			Warning: "device saved but connection failed: " + err.Error(),
		}))
		return
	}
	WriteCreated(c, dto.FromModelDevice(d))
}

func (h *Devices) Update(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Err("INVALID_ID", "invalid device id", c.Param("device_id")))
		return
	}
	existing, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		WriteErr(c, err)
		return
	}
	var req dto.DeviceUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	req.Apply(&existing)
	if err := h.Store.Update(c.Request.Context(), &existing); err != nil {
		if store.IsUniqueViolation(err) {
			c.JSON(http.StatusConflict, dto.Err("DUPLICATE_DEVICE", "a device with this host and port already exists", ""))
			return
		}
		WriteErr(c, err)
		return
	}
	// Re-connect dengan config baru. RemoveAndWait memastikan supervisor
	// goroutine roslib lama benar-benar berhenti sebelum dial baru —
	// kalau pakai Remove biasa, ada race di mana hook OnStatusChange
	// lama masih emit "closed" setelah koneksi baru sudah connected.
	h.DevMgr.RemoveAndWait(existing.ID)
	if err := h.DevMgr.Add(context.Background(), existing); err != nil {
		// Reconnect gagal — record tetap tersimpan, kasih warning ke caller.
		c.JSON(http.StatusOK, dto.OK(dto.DeviceWriteResponse{
			Device:  dto.FromModelDevice(existing),
			Warning: "device updated but reconnect failed: " + err.Error(),
		}))
		return
	}
	WriteOK(c, dto.FromModelDevice(existing))
}

func (h *Devices) Delete(c *gin.Context) {
	id, err := parseID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Err("INVALID_ID", "invalid device id", c.Param("device_id")))
		return
	}
	d, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		WriteErr(c, err)
		return
	}
	// Hapus dari DB dulu, baru disconnect. Urutan ini penting: kalau DB
	// delete gagal, device tidak dicabut dari devmgr (tidak ada state
	// inconsistency antara DB dan in-memory map).
	if err := h.Store.Delete(c.Request.Context(), id); err != nil {
		WriteErr(c, err)
		return
	}
	h.DevMgr.Remove(d.ID)
	WriteNoContent(c)
}

func parseID(c *gin.Context) (uint, error) {
	n, err := strconv.ParseUint(c.Param("device_id"), 10, 64)
	return uint(n), err
}
