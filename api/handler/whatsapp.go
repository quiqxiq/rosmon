package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/service/notification/whatsapp"
)

// WhatsApp handler untuk setup & status gateway WhatsApp (admin only).
type WhatsApp struct {
	Mgr *whatsapp.Manager
}

func NewWhatsApp(m *whatsapp.Manager) *WhatsApp { return &WhatsApp{Mgr: m} }

func (h *WhatsApp) Register(g *gin.RouterGroup) {
	r := g.Group("/whatsapp")
	r.GET("/status", h.Status)
	r.GET("/qr", h.QR)
	r.POST("/logout", h.Logout)
	r.POST("/test", h.Test)
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

func (h *WhatsApp) unavailable(c *gin.Context) {
	c.AbortWithStatusJSON(http.StatusServiceUnavailable,
		dto.Err("SERVICE_UNAVAILABLE", "whatsapp gateway not configured", c.Request.URL.Path))
}
