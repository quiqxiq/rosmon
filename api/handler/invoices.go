package handler

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/service/audit"
	"github.com/quiqxiq/rosmon/service/billing"
	"github.com/quiqxiq/rosmon/store"
	"github.com/sirupsen/logrus"
)

// Invoices handler — /invoices.
type Invoices struct {
	Store    store.InvoiceStore
	SeqStore store.SequenceStore
	SubStore store.SubscriptionStore
	Billing  *billing.Service
	Audit    store.AuditLogStore
	Log      *logrus.Logger
}

func NewInvoices(s store.InvoiceStore, seq store.SequenceStore) *Invoices {
	return &Invoices{Store: s, SeqStore: seq, Log: logrus.New()}
}

func (h *Invoices) Register(g *gin.RouterGroup) {
	h.RegisterRead(g)
	h.RegisterWrite(g)
}

// RegisterRead mounts GET endpoints (accessible to all authenticated users).
func (h *Invoices) RegisterRead(g *gin.RouterGroup) {
	r := g.Group("/invoices")
	r.GET("", h.List)
	r.GET("/:id", h.Get)
}

// RegisterWrite mounts mutating endpoints (admin+operator only).
func (h *Invoices) RegisterWrite(g *gin.RouterGroup) {
	r := g.Group("/invoices")
	r.POST("/generate", h.Generate)
	r.POST("/:id/cancel", h.Cancel)
}

func (h *Invoices) List(c *gin.Context) {
	f := store.InvoiceListFilter{}
	if v := c.Query("customer_id"); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil {
			f.CustomerID = uint(n)
		}
	}
	if v := c.Query("subscription_id"); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil {
			f.SubscriptionID = uint(n)
		}
	}
	f.Status = c.Query("status")
	if v := c.Query("year"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			f.Year = n
		}
	}
	if v := c.Query("month"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			f.Month = n
		}
	}

	items, err := h.Store.List(c.Request.Context(), f)
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

func (h *Invoices) Get(c *gin.Context) {
	id, ok := parseInvoiceID(c)
	if !ok {
		return
	}
	inv, err := h.Store.GetByID(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrInvoiceNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "invoice not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelInvoice(*inv))
}

// Generate — POST /invoices/generate. Generate invoice manual untuk satu
// subscription. Nominal di-resolve dari profil paket subscription; `amount`
// opsional sebagai override (mis. tagihan khusus). Memakai service/billing
// agar konsisten dengan cron & registrasi.
func (h *Invoices) Generate(c *gin.Context) {
	var req struct {
		SubscriptionID uint   `json:"subscription_id" binding:"required,gt=0"`
		CustomerID     uint   `json:"customer_id"     binding:"required,gt=0"`
		Amount         int64  `json:"amount"          binding:"omitempty,gt=0"`
		PeriodStart    string `json:"period_start"    binding:"required"`
		DueDays        int    `json:"due_days"        binding:"gte=0"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}

	periodStart, err := time.Parse("2006-01-02", req.PeriodStart)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ARGUMENT", "period_start must be YYYY-MM-DD", c.Request.URL.Path))
		return
	}

	dueDays := req.DueDays
	if dueDays == 0 {
		dueDays = 7
	}

	// Validasi subscription ada + customer cocok untuk mencegah invoice salah owner.
	sub, err := h.SubStore.Get(c.Request.Context(), req.SubscriptionID)
	if err != nil {
		if errors.Is(err, store.ErrSubscriptionNotFound) {
			c.AbortWithStatusJSON(http.StatusBadRequest,
				dto.Err("INVALID_ARGUMENT", "subscription not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if sub.CustomerID != req.CustomerID {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ARGUMENT", "customer_id tidak sesuai dengan customer subscription", c.Request.URL.Path))
		return
	}

	var override *int64
	if req.Amount > 0 {
		override = &req.Amount
	}

	inv, err := h.Billing.GenerateForSubscriptionWithAmount(c.Request.Context(), sub, periodStart, dueDays, override)
	if err != nil {
		if store.IsUniqueViolation(err) {
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", "invoice untuk periode ini sudah ada", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	actor := actorFromCtx(c)
	audit.Log(c.Request.Context(), h.Audit, h.Log, actor, "invoice_generated", "invoice", inv.ID,
		nil, map[string]any{"invoice_number": inv.InvoiceNumber, "amount": inv.Amount, "subscription_id": inv.SubscriptionID})
	c.JSON(http.StatusCreated, dto.OK(dto.FromModelInvoice(*inv)))
}

func (h *Invoices) Cancel(c *gin.Context) {
	id, ok := parseInvoiceID(c)
	if !ok {
		return
	}
	inv, err := h.Store.GetByID(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrInvoiceNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "invoice not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if inv.Status == "paid" {
		c.AbortWithStatusJSON(http.StatusConflict,
			dto.Err("CONFLICT", "cannot cancel a paid invoice", c.Request.URL.Path))
		return
	}
	prevStatus := inv.Status
	if err := h.Store.UpdateStatus(c.Request.Context(), id, "cancelled", nil); err != nil {
		WriteErr(c, err)
		return
	}
	inv.Status = "cancelled"
	actor := actorFromCtx(c)
	audit.Log(c.Request.Context(), h.Audit, h.Log, actor, "invoice_cancelled", "invoice", id,
		map[string]string{"status": prevStatus}, map[string]string{"status": "cancelled"})
	WriteOK(c, dto.FromModelInvoice(*inv))
}

func parseInvoiceID(c *gin.Context) (uint, bool) {
	raw := c.Param("id")
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ID", "invalid invoice id", raw))
		return 0, false
	}
	return uint(n), true
}
