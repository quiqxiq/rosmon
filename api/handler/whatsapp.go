package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/service/notification/telegram"
	"github.com/quiqxiq/rosmon/service/notification/whatsapp"
	"github.com/quiqxiq/rosmon/store"
)

// WhatsApp handler untuk setup & status gateway WhatsApp (admin only).
type WhatsApp struct {
	Mgr      *whatsapp.Manager
	TgSender *telegram.Sender // untuk POST /telegram/test
	Settings store.SettingStore
}

func NewWhatsApp(m *whatsapp.Manager) *WhatsApp { return &WhatsApp{Mgr: m} }

func (h *WhatsApp) Register(g *gin.RouterGroup) {
	r := g.Group("/whatsapp")
	r.GET("/status", h.Status)
	r.GET("/qr", h.QR)
	r.POST("/logout", h.Logout)
	r.POST("/test", h.Test)
	r.GET("/contacts", h.Contacts)
	r.GET("/groups", h.Groups)
}

// RegisterTelegramTest memasang endpoint test Telegram di group yang sama.
// Dipanggil terpisah agar bisa inject TgSender yang bisa nil.
func (h *WhatsApp) RegisterTelegramTest(g *gin.RouterGroup) {
	g.POST("/telegram/test", h.TelegramTest)
}

func (h *WhatsApp) Status(c *gin.Context) {
	if h.Mgr == nil {
		h.unavailable(c)
		return
	}
	WriteOK(c, dto.WhatsAppStatusResponse{Connected: h.Mgr.Connected(), JID: h.Mgr.JID()})
}

// QR memulai/melanjutkan pairing dan mengembalikan QR code terkini.
func (h *WhatsApp) QR(c *gin.Context) {
	if h.Mgr == nil {
		h.unavailable(c)
		return
	}
	if h.Mgr.Connected() {
		c.AbortWithStatusJSON(http.StatusConflict,
			dto.Err("CONFLICT", "whatsapp already connected", c.Request.URL.Path))
		return
	}
	code, err := h.Mgr.Login(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.WhatsAppQRResponse{Code: code})
}

func (h *WhatsApp) Logout(c *gin.Context) {
	if h.Mgr == nil {
		h.unavailable(c)
		return
	}
	if err := h.Mgr.Logout(c.Request.Context()); err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.WhatsAppStatusResponse{Connected: false})
}

// Test mengirim pesan uji ke nomor tujuan (bypass template).
func (h *WhatsApp) Test(c *gin.Context) {
	if h.Mgr == nil {
		h.unavailable(c)
		return
	}
	var req dto.WhatsAppTestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	resp, err := h.Mgr.Send(c.Request.Context(), req.Phone, req.Message)
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, gin.H{"provider_response": resp})
}

// Contacts mengembalikan daftar kontak WhatsApp dari store whatsmeow.
// Memerlukan koneksi aktif (status connected).
func (h *WhatsApp) Contacts(c *gin.Context) {
	if h.Mgr == nil {
		h.unavailable(c)
		return
	}
	if !h.Mgr.Connected() {
		c.AbortWithStatusJSON(http.StatusServiceUnavailable,
			dto.Err("NOT_CONNECTED", "whatsapp not connected", c.Request.URL.Path))
		return
	}
	contacts, err := h.Mgr.Contacts(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.WhatsAppContactItem, len(contacts))
	for i, ct := range contacts {
		out[i] = dto.WhatsAppContactItem{JID: ct.JID, Name: ct.Name, Type: "contact"}
	}
	WriteList(c, out, len(out))
}

// Groups mengembalikan daftar grup WhatsApp yang diikuti akun terpasang.
func (h *WhatsApp) Groups(c *gin.Context) {
	if h.Mgr == nil {
		h.unavailable(c)
		return
	}
	if !h.Mgr.Connected() {
		c.AbortWithStatusJSON(http.StatusServiceUnavailable,
			dto.Err("NOT_CONNECTED", "whatsapp not connected", c.Request.URL.Path))
		return
	}
	groups, err := h.Mgr.Groups(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.WhatsAppContactItem, len(groups))
	for i, g := range groups {
		out[i] = dto.WhatsAppContactItem{JID: g.JID, Name: g.Name, Type: "group"}
	}
	WriteList(c, out, len(out))
}

// TelegramTest mengirim pesan uji ke Chat ID yang dikonfigurasi di system_settings.
func (h *WhatsApp) TelegramTest(c *gin.Context) {
	var req dto.TelegramTestRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}

	// Baca konfigurasi Telegram dari settings.
	if h.Settings == nil {
		WriteErr(c, errServiceUnavailable("telegram settings not configured"))
		return
	}
	ctx := c.Request.Context()
	botToken, _ := h.Settings.Get(ctx, "notification.telegram_bot_token")
	chatID, _ := h.Settings.Get(ctx, "notification.telegram_chat_id")

	if botToken == "" || chatID == "" {
		c.AbortWithStatusJSON(http.StatusUnprocessableEntity,
			dto.Err("NOT_CONFIGURED", "telegram bot_token or chat_id not set in settings", c.Request.URL.Path))
		return
	}

	sender := telegram.New(botToken, chatID)
	msgID, err := sender.Send(ctx, "", req.Message)
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, gin.H{"provider_response": msgID})
}

func (h *WhatsApp) unavailable(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusServiceUnavailable,
		dto.Err("SERVICE_UNAVAILABLE", "whatsapp gateway not configured", c.Request.URL.Path))
}

// errServiceUnavailable adalah helper untuk membuat error service unavailable.
func errServiceUnavailable(msg string) error {
	return &serviceUnavailableError{msg: msg}
}

type serviceUnavailableError struct{ msg string }

func (e *serviceUnavailableError) Error() string { return e.msg }
