package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/store"
)

// Notifications handler untuk GET /notifications (read-only, admin). Jejak
// pengiriman notifikasi WhatsApp.
type Notifications struct {
	Store store.NotificationLogStore
}

func NewNotifications(s store.NotificationLogStore) *Notifications {
	return &Notifications{Store: s}
}

func (h *Notifications) Register(g *gin.RouterGroup) {
	g.GET("/notifications", h.List)
}

func (h *Notifications) List(c *gin.Context) {
	f := store.NotificationLogFilter{
		Status:       c.Query("status"),
		TemplateSlug: c.Query("template_slug"),
	}
	if v := c.Query("customer_id"); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil {
			id := uint(n)
			f.CustomerID = &id
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
	out := make([]dto.NotificationLogResponse, len(items))
	for i, it := range items {
		out[i] = dto.FromModelNotificationLog(it)
	}
	WriteList(c, out, len(out))
}
