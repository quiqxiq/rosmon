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
	"github.com/sirupsen/logrus"
)

// Payments handler — /payments.
type Payments struct {
	Store     store.PaymentStore
	InvStore  store.InvoiceStore
	SubStore  store.SubscriptionStore
	Log       *logrus.Logger
}

func NewPayments(ps store.PaymentStore, is store.InvoiceStore, ss store.SubscriptionStore, log *logrus.Logger) *Payments {
	if log == nil {
		log = logrus.New()
	}
	return &Payments{Store: ps, InvStore: is, SubStore: ss, Log: log}
}

func (h *Payments) Register(g *gin.RouterGroup) {
	r := g.Group("/payments")
	r.GET("", h.List)
	r.GET("/:id", h.Get)
	r.POST("", h.Create)
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

	// Verify invoice exists.
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

	// Confirm payment.
	if err := h.Store.UpdateStatus(c.Request.Context(), id, "confirmed", nil, &now, ""); err != nil {
		WriteErr(c, err)
		return
	}

	// Mark invoice paid.
	if err := h.InvStore.UpdateStatus(c.Request.Context(), p.InvoiceID, "paid", &now); err != nil {
		h.Log.WithError(err).WithField("invoice_id", p.InvoiceID).Warn("payment confirmed but invoice update failed")
	}

	// Restore subscription status if needed.
	inv, err := h.InvStore.GetByID(c.Request.Context(), p.InvoiceID)
	if err == nil && h.SubStore != nil {
		sub, subErr := h.SubStore.Get(c.Request.Context(), inv.SubscriptionID)
		if subErr == nil {
			switch sub.Status {
			case "isolir":
				// Set pending_profile_change — outbox will restore profile to normal.
				_ = h.SubStore.UpdateSyncStatus(c.Request.Context(), sub.ID, "pending_profile_change", "payment confirmed — restore profile")
				_ = h.SubStore.UpdateStatus(c.Request.Context(), sub.ID, "active", nil, nil)
			case "suspended":
				// Set pending_enable — outbox will re-enable on router.
				_ = h.SubStore.UpdateSyncStatus(c.Request.Context(), sub.ID, "pending_enable", "payment confirmed — re-enable")
				_ = h.SubStore.UpdateStatus(c.Request.Context(), sub.ID, "active", nil, nil)
			}
		}
	}

	p.Status = "confirmed"
	p.ConfirmedAt = &now
	WriteOK(c, dto.FromModelPayment(*p))
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
	if err := h.Store.UpdateStatus(c.Request.Context(), id, "rejected", nil, nil, req.Reason); err != nil {
		WriteErr(c, err)
		return
	}
	p.Status = "rejected"
	p.RejectionReason = req.Reason
	WriteOK(c, dto.FromModelPayment(*p))
}

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
