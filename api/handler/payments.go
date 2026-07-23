package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/api/sse"
	"github.com/quiqxiq/rosmon/service/notification"
	payment "github.com/quiqxiq/rosmon/service/payment"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
)

// Payments handler — /payments.
type Payments struct {
	Store        store.PaymentStore
	InvStore     store.InvoiceStore
	SubStore     store.SubscriptionStore
	Customers    store.CustomerStore
	Notification *notification.Service
	Audit        store.AuditLogStore
	Settings     store.SettingStore
	PaymentSvc   *payment.Service
	Log          *logrus.Logger
	Hub          *sse.Hub
}

func NewPayments(
	ps store.PaymentStore,
	is store.InvoiceStore,
	ss store.SubscriptionStore,
	cs store.CustomerStore,
	notif *notification.Service,
	auditStore store.AuditLogStore,
	settings store.SettingStore,
	paymentSvc *payment.Service,
	log *logrus.Logger,
	hub *sse.Hub,
) *Payments {
	if log == nil {
		log = logrus.New()
	}
	return &Payments{
		Store: ps, InvStore: is, SubStore: ss, Customers: cs,
		Notification: notif, Audit: auditStore, Settings: settings,
		PaymentSvc: paymentSvc, Log: log, Hub: hub,
	}
}

func (h *Payments) Register(g *gin.RouterGroup) {
	h.RegisterSplit(g, g)
}

func (h *Payments) RegisterSplit(readGroup, writeGroup *gin.RouterGroup) {
	r := readGroup.Group("/payments")
	r.GET("", h.List)
	r.GET("/stream", h.StreamPayments)
	r.GET("/:id", h.Get)

	w := writeGroup.Group("/payments")
	w.POST("", h.Create)
	w.POST("/collect", h.Collect)
	w.POST("/:id/confirm", h.Confirm)
	w.POST("/:id/reject", h.Reject)
}

func (h *Payments) List(c *gin.Context) {
	f := store.PaymentListFilter{}
	if v := c.Query("invoice_id"); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil {
			f.InvoiceID = uint(n)
		}
	}
	if v := c.Query("customer_id"); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil {
			f.CustomerID = uint(n)
		}
	}
	f.Status = c.Query("status")
	f.Method = c.Query("method")

	items, err := h.Store.List(c.Request.Context(), f)
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

func (h *Payments) Get(c *gin.Context) {
	id, ok := parsePaymentID(c)
	if !ok {
		return
	}
	p, err := h.Store.GetByID(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrPaymentNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "payment not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelPayment(*p))
}

func (h *Payments) Create(c *gin.Context) {
	var req dto.PaymentCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}

	p := &model.Payment{
		InvoiceID:       req.InvoiceID,
		CustomerID:      req.CustomerID,
		Amount:          req.Amount,
		Method:          req.Method,
		ReferenceNumber: req.ReferenceNumber,
		ProofURL:        req.ProofURL,
		BankName:        req.BankName,
		IdempotencyKey:  req.IdempotencyKey,
	}

	actor := actorUserID(c)
	created, err := h.PaymentSvc.CreateManual(c.Request.Context(), p, actor)
	if err != nil {
		if store.IsUniqueViolation(err) {
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", "pembayaran dengan key ini sudah pernah diproses", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, dto.OK(dto.FromModelPayment(*created)))
}

// Confirm — admin confirms a pending payment, marks invoice paid, restores subscription.
func (h *Payments) Confirm(c *gin.Context) {
	id, ok := parsePaymentID(c)
	if !ok {
		return
	}
	actor := actorUserID(c)
	confirmed, err := h.PaymentSvc.Confirm(c.Request.Context(), id, actor)
	if err != nil {
		if errors.Is(err, store.ErrPaymentNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "payment not found", c.Request.URL.Path))
			return
		}
		if strings.Contains(err.Error(), "already") {
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", err.Error(), c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelPayment(*confirmed))
}

// Collect — settle-by-code. Petugas scan QR / input kode unik invoice saat
// menerima tunai → catat pembayaran cash 'confirmed' instan + pulihkan layanan.
// Idempoten via IdempotencyKey "code:<code>" (scan ganda aman).
func (h *Payments) Collect(c *gin.Context) {
	var req dto.PaymentCollectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	method := req.Method
	if method == "" {
		method = "cash"
	}

	ctx := c.Request.Context()
	inv, err := h.InvStore.GetByPaymentCode(ctx, req.Code)
	if err != nil {
		if errors.Is(err, store.ErrInvoiceNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "kode pembayaran tidak ditemukan", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if inv.Status == "paid" {
		c.AbortWithStatusJSON(http.StatusConflict,
			dto.Err("CONFLICT", "tagihan sudah lunas", c.Request.URL.Path))
		return
	}
	if inv.Status == "cancelled" {
		c.AbortWithStatusJSON(http.StatusConflict,
			dto.Err("CONFLICT", "tagihan dibatalkan", c.Request.URL.Path))
		return
	}

	p := &model.Payment{
		InvoiceID:      inv.ID,
		CustomerID:     inv.CustomerID,
		Amount:         inv.Amount,
		Method:         method,
		IdempotencyKey: "code:" + req.Code,
	}

	actor := actorUserID(c)
	created, err := h.PaymentSvc.CreateManual(ctx, p, actor)
	if err != nil {
		if store.IsUniqueViolation(err) {
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", "kode sudah pernah dibayar", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}

	now := time.Now()
	WriteCreated(c, gin.H{
		"payment": dto.FromModelPayment(*created),
		"invoice": dto.FromModelInvoice(markPaid(*inv, now)),
	})
}

func (h *Payments) Reject(c *gin.Context) {
	id, ok := parsePaymentID(c)
	if !ok {
		return
	}
	var req struct {
		Reason string `json:"reason" binding:"max=500"`
	}
	_ = c.ShouldBindJSON(&req)

	actor := actorUserID(c)
	rejected, err := h.PaymentSvc.Reject(c.Request.Context(), id, req.Reason, actor)
	if err != nil {
		if errors.Is(err, store.ErrPaymentNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "payment not found", c.Request.URL.Path))
			return
		}
		if strings.Contains(err.Error(), "already") {
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", err.Error(), c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelPayment(*rejected))
}

// StreamPayments membuka SSE stream untuk admin menerima notifikasi real-time
// saat pelanggan mengunggah bukti pembayaran baru di portal.
// GET /payments/stream
func (h *Payments) StreamPayments(c *gin.Context) {
	if h.Hub == nil {
		c.AbortWithStatusJSON(http.StatusServiceUnavailable,
			dto.Err("SERVICE_UNAVAILABLE", "SSE hub tidak tersedia", c.Request.URL.Path))
		return
	}
	release, err := h.Hub.Reserve(sse.TopicPayments, "")
	if err != nil {
		c.Header("Retry-After", "30")
		c.AbortWithStatusJSON(http.StatusTooManyRequests,
			dto.Err("RATE_LIMIT", "terlalu banyak subscriber SSE", c.Request.URL.Path))
		return
	}
	defer release()
	broker := h.Hub.GetOrCreate(sse.TopicPayments,
		func(b *sse.Broker) error { return nil },
		func() {},
	)
	sse.Stream(c, broker)
}

// markPaid mengembalikan salinan invoice dengan status paid (untuk response;
// re-fetch tak perlu).
func markPaid(inv model.Invoice, at time.Time) model.Invoice {
	inv.Status = "paid"
	inv.PaidAt = &at
	return inv
}

// rupiah memformat nominal jadi "Rp 150.000".
func rupiah(amount int64) string {
	s := strconv.FormatInt(amount, 10)
	n := len(s)
	if n <= 3 {
		return "Rp " + s
	}
	var out []byte
	for i, d := range []byte(s) {
		if i > 0 && (n-i)%3 == 0 {
			out = append(out, '.')
		}
		out = append(out, d)
	}
	return "Rp " + string(out)
}

// actorUserID adalah alias untuk actorFromCtx (backward-compat dalam package).
func actorUserID(c *gin.Context) *uint { return actorFromCtx(c) }

func parsePaymentID(c *gin.Context) (uint, bool) {
	raw := c.Param("id")
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ID", "invalid payment id", raw))
		return 0, false
	}
	return uint(n), true
}
