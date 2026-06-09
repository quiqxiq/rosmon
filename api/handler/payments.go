package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/service/audit"
	"github.com/quiqxiq/rosmon/service/notification"
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
	Log          *logrus.Logger
}

func NewPayments(
	ps store.PaymentStore,
	is store.InvoiceStore,
	ss store.SubscriptionStore,
	cs store.CustomerStore,
	notif *notification.Service,
	auditStore store.AuditLogStore,
	settings store.SettingStore,
	log *logrus.Logger,
) *Payments {
	if log == nil {
		log = logrus.New()
	}
	return &Payments{
		Store: ps, InvStore: is, SubStore: ss, Customers: cs,
		Notification: notif, Audit: auditStore, Settings: settings, Log: log,
	}
}

func (h *Payments) Register(g *gin.RouterGroup) {
	r := g.Group("/payments")
	r.GET("", h.List)
	r.GET("/:id", h.Get)
	r.POST("", h.Create)
	r.POST("/collect", h.Collect)
	r.POST("/:id/confirm", h.Confirm)
	r.POST("/:id/reject", h.Reject)
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

	inv, err := h.InvStore.GetByID(c.Request.Context(), req.InvoiceID)
	if err != nil {
		if errors.Is(err, store.ErrInvoiceNotFound) {
			c.AbortWithStatusJSON(http.StatusBadRequest,
				dto.Err("INVALID_ARGUMENT", "invoice not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if inv.Status == "paid" || inv.Status == "cancelled" {
		c.AbortWithStatusJSON(http.StatusConflict,
			dto.Err("CONFLICT", fmt.Sprintf("invoice is already %s", inv.Status), c.Request.URL.Path))
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
		Status:          "pending",
	}
	// Validasi CustomerID harus cocok dengan invoice.CustomerID untuk mencegah
	// korupsi data (staff tidak bisa set customer_id yang salah untuk invoice milik customer lain).
	if inv.CustomerID != 0 && req.CustomerID != inv.CustomerID {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ARGUMENT", "customer_id tidak sesuai dengan customer invoice", c.Request.URL.Path))
		return
	}
	if err := h.Store.Create(c.Request.Context(), p); err != nil {
		WriteErr(c, err)
		return
	}
	c.JSON(http.StatusCreated, dto.OK(dto.FromModelPayment(*p)))
}

// Confirm — admin confirms a pending payment, marks invoice paid, restores subscription.
func (h *Payments) Confirm(c *gin.Context) {
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
	if p.Status != "pending" {
		c.AbortWithStatusJSON(http.StatusConflict,
			dto.Err("CONFLICT", fmt.Sprintf("payment is already %s", p.Status), c.Request.URL.Path))
		return
	}

	now := time.Now()
	actor := actorUserID(c)
	if err := h.Store.UpdateStatus(c.Request.Context(), id, "confirmed", actor, &now, ""); err != nil {
		WriteErr(c, err)
		return
	}
	p.Status = "confirmed"
	p.ConfirmedAt = &now
	p.ConfirmedBy = actor

	h.applySettlement(c.Request.Context(), p)
	h.audit(c.Request.Context(), actor, "payment_confirmed", p.ID, "pending", "confirmed")
	WriteOK(c, dto.FromModelPayment(*p))
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

	now := time.Now()
	actor := actorUserID(c)
	p := &model.Payment{
		InvoiceID:      inv.ID,
		CustomerID:     inv.CustomerID,
		Amount:         inv.Amount,
		Method:         method,
		Status:         "confirmed",
		ConfirmedBy:    actor,
		ConfirmedAt:    &now,
		IdempotencyKey: "code:" + req.Code,
	}
	if err := h.Store.Create(ctx, p); err != nil {
		// Idempotency-key bentrok → kode ini sudah pernah di-settle.
		if store.IsUniqueViolation(err) {
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", "kode sudah pernah dibayar", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}

	h.applySettlement(ctx, p)
	h.audit(ctx, actor, "payment_collected", p.ID, inv.Status, "confirmed")

	WriteCreated(c, gin.H{
		"payment": dto.FromModelPayment(*p),
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
	if p.Status != "pending" {
		c.AbortWithStatusJSON(http.StatusConflict,
			dto.Err("CONFLICT", fmt.Sprintf("payment is already %s", p.Status), c.Request.URL.Path))
		return
	}
	actor := actorUserID(c)
	if err := h.Store.UpdateStatus(c.Request.Context(), id, "rejected", nil, nil, req.Reason); err != nil {
		WriteErr(c, err)
		return
	}
	p.Status = "rejected"
	p.RejectionReason = req.Reason
	h.audit(c.Request.Context(), actor, "payment_rejected", p.ID, "pending", "rejected")
	WriteOK(c, dto.FromModelPayment(*p))
}

// ── shared settlement effects ────────────────────────────────────────────────

// applySettlement menandai invoice paid + memulihkan subscription (lewat outbox)
// + kirim notifikasi. Dipakai oleh Confirm & Collect. Best-effort (kegagalan
// non-fatal — pembayaran sudah tercatat).
func (h *Payments) applySettlement(ctx context.Context, p *model.Payment) {
	now := time.Now()
	if err := h.InvStore.UpdateStatus(ctx, p.InvoiceID, "paid", &now); err != nil {
		h.Log.WithError(err).WithField("invoice_id", p.InvoiceID).Warn("settle: invoice update failed")
	}

	inv, err := h.InvStore.GetByID(ctx, p.InvoiceID)
	if err != nil {
		return
	}
	restored := false
	if h.SubStore != nil {
		if sub, subErr := h.SubStore.Get(ctx, inv.SubscriptionID); subErr == nil {
			switch sub.Status {
			case "isolir":
				// Penting: UpdateStatus DULU sebelum UpdateSyncStatus agar outbox
				// membaca status 'active' yang benar saat memproses pending_profile_change.
				_ = h.SubStore.UpdateStatus(ctx, sub.ID, "active", nil, nil)
				_ = h.SubStore.UpdateSyncStatus(ctx, sub.ID, "pending_profile_change", "payment settled — restore profile")
				restored = true
			case "suspended":
				_ = h.SubStore.UpdateStatus(ctx, sub.ID, "active", nil, nil)
				_ = h.SubStore.UpdateSyncStatus(ctx, sub.ID, "pending_enable", "payment settled — re-enable")
				restored = true
			}
		}
	}

	h.notifyPaid(ctx, inv, restored)
}

func (h *Payments) notifyPaid(ctx context.Context, inv *model.Invoice, restored bool) {
	if h.Notification == nil || h.Customers == nil {
		return
	}
	cust, err := h.Customers.Get(ctx, inv.CustomerID)
	if err != nil || cust.Phone == "" {
		return
	}
	cid := cust.ID
	h.Notification.NotifyAsync(&cid, cust.Phone, "payment_confirmed", map[string]string{
		"customer_name":  cust.FullName,
		"invoice_number": inv.InvoiceNumber,
		"amount":         rupiah(inv.Amount),
	})
	if restored {
		h.Notification.NotifyAsync(&cid, cust.Phone, "service_restored", map[string]string{
			"customer_name": cust.FullName,
			"company_name":  h.setting(ctx, "general.company_name", ""),
		})
	}
}

func (h *Payments) audit(ctx context.Context, userID *uint, action string, paymentID uint, oldStatus, newStatus string) {
	if h.Audit == nil {
		return
	}
	audit.Log(ctx, h.Audit, h.Log, userID, action, "payment", paymentID,
		map[string]string{"status": oldStatus}, map[string]string{"status": newStatus})
}

func (h *Payments) setting(ctx context.Context, key, def string) string {
	if h.Settings == nil {
		return def
	}
	v, err := h.Settings.Get(ctx, key)
	if err != nil || v == "" {
		return def
	}
	return v
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
