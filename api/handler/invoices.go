package handler

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
)

// Invoices handler — /invoices.
type Invoices struct {
	Store    store.InvoiceStore
	SeqStore store.SequenceStore
}

func NewInvoices(s store.InvoiceStore, seq store.SequenceStore) *Invoices {
	return &Invoices{Store: s, SeqStore: seq}
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

// Generate — POST /invoices/generate. Manual generate invoice untuk testing/backfill.
func (h *Invoices) Generate(c *gin.Context) {
	var req struct {
		SubscriptionID uint   `json:"subscription_id" binding:"required,gt=0"`
		CustomerID     uint   `json:"customer_id"     binding:"required,gt=0"`
		Amount         int64  `json:"amount"          binding:"required,gt=0"`
		PeriodStart    string `json:"period_start"   binding:"required"`
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

	now := time.Now()
	seq, err := h.SeqStore.NextVal(c.Request.Context(), "INV", now.Year(), int(now.Month()))
	if err != nil {
		WriteErr(c, fmt.Errorf("generate invoice number: %w", err))
		return
	}
	invNumber := h.SeqStore.FormatNumber("INV", now.Year(), int(now.Month()), seq)

	periodEnd := periodStart.AddDate(0, 1, -1)
	dueDate := periodStart.AddDate(0, 0, dueDays)
	issuedAt := now

	inv := &model.Invoice{
		InvoiceNumber:  invNumber,
		CustomerID:     req.CustomerID,
		SubscriptionID: req.SubscriptionID,
		Amount:         req.Amount,
		PeriodStart:    periodStart,
		PeriodEnd:      periodEnd,
		DueDate:        dueDate,
		Status:         "issued",
		IssuedAt:       &issuedAt,
		PaymentCode:    store.NewPaymentCode(),
	}
	item := model.InvoiceItem{
		Description: fmt.Sprintf("Langganan periode %s – %s",
			periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02")),
		Quantity:  1,
		UnitPrice: req.Amount,
		Amount:    req.Amount,
	}

	if err := h.Store.Create(c.Request.Context(), inv, []model.InvoiceItem{item}); err != nil {
		WriteErr(c, err)
		return
	}
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
	if err := h.Store.UpdateStatus(c.Request.Context(), id, "cancelled", nil); err != nil {
		WriteErr(c, err)
		return
	}
	inv.Status = "cancelled"
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
