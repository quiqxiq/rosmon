package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/store"
)

// notifEventDefs mendefinisikan semua event yang bisa dikonfigurasi routing-nya.
// Key = slug setting (tanpa prefix "notification.event." dan suffix ".targets").
var notifEventDefs = []dto.NotificationEventConfig{
	{
		Event:       "invoice_issued",
		Label:       "Tagihan Terbit",
		Description: "Dikirim saat invoice baru dibuat untuk subscription.",
	},
	{
		Event:       "invoice_reminder",
		Label:       "Pengingat Jatuh Tempo",
		Description: "Dikirim H-3 dan H-0 sebelum tagihan jatuh tempo.",
	},
	{
		Event:       "service_isolir",
		Label:       "Layanan Diisolir",
		Description: "Dikirim saat subscription berubah status menjadi isolir.",
	},
	{
		Event:       "service_suspend",
		Label:       "Layanan Disuspend",
		Description: "Dikirim saat subscription berubah status menjadi suspended.",
	},
	{
		Event:       "payment_received",
		Label:       "Pembayaran Diterima",
		Description: "Dikirim saat pembayaran berhasil dikonfirmasi.",
	},
	{
		Event:       "registration_approved",
		Label:       "Registrasi Disetujui",
		Description: "Dikirim saat pendaftaran pelanggan baru disetujui.",
	},
}

// settingKey mengembalikan system_settings key untuk event + field.
func settingKey(event, field string) string {
	return "notification.event." + event + "." + field
}

// parseTargets mengurai value setting (CSV) menjadi slice.
func parseTargets(v string) []string {
	if strings.TrimSpace(v) == "" {
		return []string{}
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// NotificationEvents handler — GET/PUT konfigurasi routing notifikasi per-event.
type NotificationEvents struct {
	Settings store.SettingStore
}

func NewNotificationEvents(s store.SettingStore) *NotificationEvents {
	return &NotificationEvents{Settings: s}
}

func (h *NotificationEvents) Register(g *gin.RouterGroup) {
	r := g.Group("/notification-events")
	r.GET("", h.List)
	r.PUT("/:event", h.Update)
}

// List mengembalikan semua event yang didukung beserta konfigurasi targets saat ini.
func (h *NotificationEvents) List(c *gin.Context) {
	ctx := c.Request.Context()
	out := make([]dto.NotificationEventConfig, len(notifEventDefs))
	for i, def := range notifEventDefs {
		cfg := dto.NotificationEventConfig{
			Event:       def.Event,
			Label:       def.Label,
			Description: def.Description,
		}
		v, err := h.Settings.Get(ctx, settingKey(def.Event, "targets"))
		if err == nil {
			cfg.Targets = parseTargets(v)
		} else {
			cfg.Targets = []string{}
		}
		out[i] = cfg
	}
	WriteList(c, out, len(out))
}

// Update mengubah targets untuk satu event.
func (h *NotificationEvents) Update(c *gin.Context) {
	event := c.Param("event")

	// Validasi event dikenal.
	known := false
	for _, def := range notifEventDefs {
		if def.Event == event {
			known = true
			break
		}
	}
	if !known {
		c.AbortWithStatusJSON(http.StatusNotFound,
			dto.Err("NOT_FOUND", "unknown notification event", c.Request.URL.Path))
		return
	}

	var req dto.NotificationEventUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}

	value := strings.Join(req.Targets, ",")
	key := settingKey(event, "targets")

	// Pakai Set jika ada, atau upsert via SetOrCreate.
	if err := h.Settings.SetOrCreate(c.Request.Context(), key, value); err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, gin.H{"event": event, "targets": req.Targets})
}
