package dto

// ── WhatsApp contacts / groups ─────────────────────────────────────────────

// WhatsAppContactItem adalah satu entri kontak atau grup di picker frontend.
type WhatsAppContactItem struct {
	JID  string `json:"jid"`
	Name string `json:"name"`
	Type string `json:"type"` // "contact" | "group"
}

// ── Notification event routing ─────────────────────────────────────────────

// NotificationEventConfig adalah konfigurasi target pengiriman per event.
// Disimpan di system_settings sebagai key:
//
//	notification.event.<slug>.targets  = "wa_admin,wa_group:xxx@g.us,tg_admin"
//
// Token yang dikenali oleh notification.Service:
//   - "wa_admin"          → kirim ke notification.admin_phone (WhatsApp)
//   - "wa_group:<jid>"   → kirim ke grup WA dengan JID tsb
//   - "wa_number:<phone>" → kirim ke nomor spesifik (WhatsApp)
//   - "tg_admin"          → kirim ke notification.telegram_chat_id
type NotificationEventConfig struct {
	Event       string   `json:"event"`        // slug event, e.g. "invoice_issued"
	Label       string   `json:"label"`        // label ramah pengguna
	Description string   `json:"description"`  // penjelasan singkat
	Targets     []string `json:"targets"`      // token-token target
}

// NotificationEventUpdateRequest adalah payload PUT untuk update targets.
type NotificationEventUpdateRequest struct {
	Targets []string `json:"targets" binding:"required"`
}

// ── Telegram test ──────────────────────────────────────────────────────────

// TelegramTestRequest adalah payload POST /telegram/test.
type TelegramTestRequest struct {
	Message string `json:"message" binding:"required,min=1"`
}
