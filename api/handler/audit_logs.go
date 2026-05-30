package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/store"
)

// AuditLogs handler untuk GET /audit-logs (read-only, admin). Resource murni
// DB — jejak aksi yang mengubah status entitas utama.
type AuditLogs struct {
	Store store.AuditLogStore
}

func NewAuditLogs(s store.AuditLogStore) *AuditLogs { return &AuditLogs{Store: s} }

func (h *AuditLogs) Register(g *gin.RouterGroup) {
	g.GET("/audit-logs", h.List)
}

func (h *AuditLogs) List(c *gin.Context) {
	f := store.AuditLogFilter{
		EntityType: c.Query("entity_type"),
		Action:     c.Query("action"),
	}
	if v := c.Query("entity_id"); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil {
			id := uint(n)
			f.EntityID = &id
		}
	}
	if v := c.Query("user_id"); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil {
			id := uint(n)
			f.UserID = &id
		}
	}
	if v := c.Query("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			f.Limit = n
		}
	}
	items, err := h.Store.List(c.Request.Context(), f)
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.AuditLogResponse, len(items))
	for i, it := range items {
		out[i] = dto.FromModelAuditLog(it)
	}
	WriteList(c, out, len(out))
}
