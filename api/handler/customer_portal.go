package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/api/middleware"
	"github.com/quiqxiq/rosmon/api/sse"
	"github.com/quiqxiq/rosmon/service/auth"
	"github.com/quiqxiq/rosmon/service/payment"
	"github.com/quiqxiq/rosmon/service/portal"
	"github.com/quiqxiq/rosmon/store"
)

// CustomerPortal handler — endpoint self-service pelanggan (/api/customer/*).
// Semua di-scope ke CustomerID dari token (anti-IDOR).
type CustomerPortal struct {
	Portal    *portal.CustomerAuth
	Customers store.CustomerStore
	Subs      store.SubscriptionStore
	Invoices  store.InvoiceStore
	Payments  store.PaymentStore
	// PaymentSvc nil jika Xendit tidak dikonfigurasi → endpoint /pay mengembalikan 503.
	PaymentSvc *payment.Service
	// Hub untuk SSE notifikasi admin real-time. Nil = notifikasi dilewati (no-op).
	Hub *sse.Hub
}

func NewCustomerPortal(
	p *portal.CustomerAuth,
	cs store.CustomerStore,
	ss store.SubscriptionStore,
	is store.InvoiceStore,
	ps store.PaymentStore,
) *CustomerPortal {
	return &CustomerPortal{Portal: p, Customers: cs, Subs: ss, Invoices: is, Payments: ps}
}

func (h *CustomerPortal) Register(g *gin.RouterGroup) {
	r := g.Group("/customer")
	r.GET("/me", h.Me)
	r.GET("/subscriptions", h.Subscriptions)
	r.GET("/subscriptions/:id/status", h.SubscriptionStatus)
	r.GET("/invoices", h.ListInvoices)
	r.GET("/invoices/:id", h.GetInvoice)
	r.POST("/invoices/:id/pay", h.PayInvoice)
	r.GET("/payments", h.PaymentHistory)
	r.POST("/change-password", h.ChangePassword)
	r.GET("/payment-gateway/status", h.GetGatewayStatus)
}

// currentCustomerID mengambil CustomerID dari token customer.
func currentCustomerID(c *gin.Context) (uint, bool) {
	claims, ok := middleware.CustomerClaimsFrom(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized,
			dto.Err("UNAUTHORIZED", "no customer authentication context", c.Request.URL.Path))
		return 0, false
	}
	return claims.CustomerID, true
}

func (h *CustomerPortal) Me(c *gin.Context) {
	cid, ok := currentCustomerID(c)
	if !ok {
		return
	}
	cust, err := h.Customers.Get(c.Request.Context(), cid)
	if err != nil {
		if errors.Is(err, store.ErrCustomerNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "customer not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelCustomerMe(cust))
}

func (h *CustomerPortal) Subscriptions(c *gin.Context) {
	cid, ok := currentCustomerID(c)
	if !ok {
		return
	}
	subs, err := h.Subs.List(c.Request.Context(), store.SubscriptionListFilter{CustomerID: cid})
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.SubscriptionResponse, len(subs))
	for i, s := range subs {
		out[i] = dto.FromModelSubscription(s)
	}
	WriteList(c, out, len(out))
}

func (h *CustomerPortal) SubscriptionStatus(c *gin.Context) {
	cid, ok := currentCustomerID(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	sub, err := h.Subs.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrSubscriptionNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "subscription not found", c.Request.URL.Path))
			return
		}
		// DB error — jangan expose sebagai 404, ini bisa menyembunyikan masalah serius
		WriteErr(c, err)
		return
	}
	// Ownership check — customer hanya bisa lihat subscriptionnya sendiri (anti-IDOR).
	if sub.CustomerID != cid {
		c.AbortWithStatusJSON(http.StatusNotFound,
			dto.Err("NOT_FOUND", "subscription not found", c.Request.URL.Path))
		return
	}
	WriteOK(c, dto.FromModelSubscription(sub))
}

func (h *CustomerPortal) ListInvoices(c *gin.Context) {
	cid, ok := currentCustomerID(c)
	if !ok {
		return
	}
	items, err := h.Invoices.List(c.Request.Context(), store.InvoiceListFilter{
		CustomerID: cid,
		Status:     c.Query("status"),
	})
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.InvoiceResponse, len(items))
	for i, it := range items {
		out[i] = dto.FromModelInvoice(it)
	}
	WriteList(c, out, len(out))
}

func (h *CustomerPortal) GetInvoice(c *gin.Context) {
	cid, ok := currentCustomerID(c)
	if !ok {
		return
	}
	id, ok := parseUintParam(c, "id")
	if !ok {
		return
	}
	inv, err := h.Invoices.GetByID(c.Request.Context(), id)
	if err != nil || inv.CustomerID != cid {
		c.AbortWithStatusJSON(http.StatusNotFound,
			dto.Err("NOT_FOUND", "invoice not found", c.Request.URL.Path))
		return
	}
	WriteOK(c, dto.FromModelInvoice(*inv))
}

func (h *CustomerPortal) PaymentHistory(c *gin.Context) {
	cid, ok := currentCustomerID(c)
	if !ok {
		return
	}
	items, err := h.Payments.List(c.Request.Context(), store.PaymentListFilter{CustomerID: cid})
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.PaymentResponse, len(items))
	for i, it := range items {
		out[i] = dto.FromModelPayment(it)
	}
	WriteList(c, out, len(out))
}

// PayInvoice memulai pembayaran online untuk invoice milik customer (jika gateway aktif),
// atau menyimpan bukti pembayaran manual jika Content-Length > 0.
// POST /customer/invoices/:id/pay
func (h *CustomerPortal) PayInvoice(c *gin.Context) {
	cid, ok := currentCustomerID(c)
	if !ok {
		return
	}
	invoiceID, ok := parseUintParam(c, "id")
	if !ok {
		return
	}

	// 1. Cek apakah ada body untuk upload bukti manual.
	if c.Request.ContentLength > 0 {
		var uploadReq dto.PortalPaymentUploadRequest
		if err := c.ShouldBindJSON(&uploadReq); err != nil {
			WriteValidationErr(c, err)
			return
		}
		// Pastikan proof_url berasal dari server ini, bukan URL eksternal sembarang.
		if !strings.HasPrefix(uploadReq.ProofURL, "/uploads/") {
			WriteValidationErr(c, fmt.Errorf("proof_url harus dimulai dari /uploads/"))
			return
		}
		if h.PaymentSvc == nil {
			c.AbortWithStatusJSON(http.StatusServiceUnavailable,
				dto.Err("SERVICE_UNAVAILABLE", "layanan pembayaran tidak tersedia", c.Request.URL.Path))
			return
		}
		pmt, err := h.PaymentSvc.CreatePortalPayment(c.Request.Context(), invoiceID, cid, uploadReq.ProofURL, uploadReq.BankName, uploadReq.ReferenceNumber)
		if err != nil {
			msg := err.Error()
			switch {
			case containsAny(msg, "sudah lunas", "sudah dibatalkan"):
				c.AbortWithStatusJSON(http.StatusConflict,
					dto.Err("CONFLICT", msg, c.Request.URL.Path))
			case containsAny(msg, "bukan milik customer", "not found"):
				c.AbortWithStatusJSON(http.StatusNotFound,
					dto.Err("NOT_FOUND", "invoice not found", c.Request.URL.Path))
			default:
				c.AbortWithStatusJSON(http.StatusInternalServerError,
					dto.Err("INTERNAL", "gagal mengunggah bukti pembayaran", c.Request.URL.Path))
			}
			return
		}
		// Notifikasi admin via SSE (non-fatal, best-effort).
		if h.Hub != nil {
			broker := h.Hub.GetOrCreate(sse.TopicPayments,
				func(b *sse.Broker) error { return nil },
				func() {},
			)
			broker.Publish(sse.Event{
				Type: "payment_uploaded",
				Data: dto.FromModelPayment(*pmt),
			})
		}
		WriteCreated(c, dto.FromModelPayment(*pmt))
		return
	}

	// 2. Jalur online gateway.
	if h.PaymentSvc == nil || !h.PaymentSvc.IsEnabled(c.Request.Context()) {
		c.AbortWithStatusJSON(http.StatusServiceUnavailable,
			dto.Err("SERVICE_UNAVAILABLE", "pembayaran online tidak tersedia", c.Request.URL.Path))
		return
	}

	result, err := h.PaymentSvc.InitiatePayment(c.Request.Context(), invoiceID, cid)
	if err != nil {
		msg := err.Error()
		switch {
		case containsAny(msg, "sudah lunas", "sudah dibatalkan"):
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", msg, c.Request.URL.Path))
		case containsAny(msg, "bukan milik customer", "not found"):
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "invoice not found", c.Request.URL.Path))
		default:
			c.AbortWithStatusJSON(http.StatusInternalServerError,
				dto.Err("INTERNAL", "gagal membuat link pembayaran", c.Request.URL.Path))
		}
		return
	}

	c.JSON(http.StatusOK, dto.OK(dto.InitiatePaymentResponse{
		PaymentID:  result.PaymentID,
		InvoiceURL: result.InvoiceURL,
		ExpiresAt:  result.ExpiresAt.Format("2006-01-02T15:04:05Z07:00"),
	}))
}

func (h *CustomerPortal) GetGatewayStatus(c *gin.Context) {
	enabled := false
	if h.PaymentSvc != nil {
		enabled = h.PaymentSvc.IsEnabled(c.Request.Context())
	}
	c.JSON(http.StatusOK, dto.OK(gin.H{"enabled": enabled}))
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if len(s) >= len(sub) {
			for i := 0; i <= len(s)-len(sub); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
		}
	}
	return false
}

func (h *CustomerPortal) ChangePassword(c *gin.Context) {
	cid, ok := currentCustomerID(c)
	if !ok {
		return
	}
	var req dto.ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	err := h.Portal.ChangePassword(c.Request.Context(), cid, req.OldPassword, req.NewPassword)
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrInvalidCredentials):
			c.AbortWithStatusJSON(http.StatusBadRequest,
				dto.Err("INVALID_ARGUMENT", "password lama salah", c.Request.URL.Path))
		case errors.Is(err, auth.ErrWeakPassword):
			c.AbortWithStatusJSON(http.StatusBadRequest,
				dto.Err("INVALID_ARGUMENT", "password baru minimal 8 karakter", c.Request.URL.Path))
		default:
			WriteErr(c, err)
		}
		return
	}
	WriteOK(c, gin.H{"message": "password updated"})
}

func parseUintParam(c *gin.Context, name string) (uint, bool) {
	raw := c.Param(name)
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ID", "invalid "+name, raw))
		return 0, false
	}
	return uint(n), true
}
