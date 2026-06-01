package handler

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	paymentSvc "github.com/quiqxiq/rosmon/service/payment"
	"github.com/quiqxiq/rosmon/service/notification"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
)

// XenditWebhook menangani callback dari Xendit setelah invoice dibayar/expired.
//
// Route: POST /public/webhooks/xendit (tanpa auth JWT — diproteksi oleh x-callback-token).
// Idempotent: jika payment sudah confirmed, kembalikan 200 tanpa efek ganda.
type XenditWebhook struct {
	PaymentSvc   *paymentSvc.Service
	Payments     store.PaymentStore
	Invoices     store.InvoiceStore
	Subs         store.SubscriptionStore
	Customers    store.CustomerStore
	Notification *notification.Service
	Settings     store.SettingStore
	Log          *logrus.Logger
}

func NewXenditWebhook(
	svc *paymentSvc.Service,
	ps store.PaymentStore,
	is store.InvoiceStore,
	ss store.SubscriptionStore,
	cs store.CustomerStore,
	notif *notification.Service,
	settings store.SettingStore,
	log *logrus.Logger,
) *XenditWebhook {
	if log == nil {
		log = logrus.New()
	}
	return &XenditWebhook{
		PaymentSvc:   svc,
		Payments:     ps,
		Invoices:     is,
		Subs:         ss,
		Customers:    cs,
		Notification: notif,
		Settings:     settings,
		Log:          log,
	}
}

func (h *XenditWebhook) Register(g *gin.RouterGroup) {
	g.POST("/public/webhooks/xendit", h.Handle)
}

// Handle memproses callback Xendit Invoice.
func (h *XenditWebhook) Handle(c *gin.Context) {
	// 1. Baca raw body dulu (sebelum binding) untuk verifikasi signature.
	rawBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		h.Log.WithError(err).Warn("xendit webhook: read body failed")
		c.JSON(http.StatusBadRequest, dto.Err("BAD_REQUEST", "cannot read body", c.Request.URL.Path))
		return
	}

	// 2. Kumpulkan semua header (lowercase key) untuk verifikasi.
	headers := make(map[string]string, len(c.Request.Header))
	for k, v := range c.Request.Header {
		if len(v) > 0 {
			headers[strings.ToLower(k)] = v[0]
		}
	}

	// 3. Verifikasi signature webhook.
	if h.PaymentSvc != nil {
		if verifyErr := h.PaymentSvc.VerifyWebhookSignature(rawBody, headers); verifyErr != nil {
			h.Log.WithError(verifyErr).Warn("xendit webhook: signature invalid")
			c.JSON(http.StatusUnauthorized, dto.Err("UNAUTHORIZED", "invalid callback token", c.Request.URL.Path))
			return
		}
	}

	// 4. Parse event.
	evt, err := h.PaymentSvc.ParseWebhookEvent(rawBody)
	if err != nil {
		h.Log.WithError(err).Warn("xendit webhook: parse event failed")
		c.JSON(http.StatusBadRequest, dto.Err("BAD_REQUEST", "cannot parse webhook event", c.Request.URL.Path))
		return
	}

	log := h.Log.WithFields(logrus.Fields{
		"gateway":      evt.GatewayName,
		"external_ref": evt.ExternalRef,
		"status":       evt.Status,
	})

	ctx := c.Request.Context()

	// 5. Lookup payment berdasarkan ExternalRef.
	p, err := h.Payments.GetByExternalRef(ctx, evt.GatewayName, evt.ExternalRef)
	if err != nil {
		if errors.Is(err, store.ErrPaymentNotFound) {
			// Bisa terjadi jika webhook datang sebelum UpdateGatewayInfo selesai (race condition).
			// Kembalikan 200 agar Xendit tidak retry agresif.
			log.Warn("xendit webhook: payment not found for external_ref")
			c.JSON(http.StatusOK, gin.H{"status": "unknown", "message": "payment not found"})
			return
		}
		log.WithError(err).Error("xendit webhook: lookup payment failed")
		c.JSON(http.StatusInternalServerError, dto.Err("INTERNAL", "internal error", c.Request.URL.Path))
		return
	}

	// 6. Idempotency: jika sudah confirmed, langsung OK.
	if p.Status == "confirmed" {
		log.Info("xendit webhook: already confirmed, skip")
		c.JSON(http.StatusOK, gin.H{"status": "already_confirmed"})
		return
	}

	switch evt.Status {
	case "paid":
		h.handlePaid(c, ctx, p, log)
	case "expired", "failed":
		h.handleExpiredOrFailed(ctx, p, evt.Status, log)
		c.JSON(http.StatusOK, gin.H{"status": evt.Status})
	default:
		log.WithField("event_status", evt.Status).Info("xendit webhook: unhandled status, ignore")
		c.JSON(http.StatusOK, gin.H{"status": "ignored"})
	}
}

func (h *XenditWebhook) handlePaid(c *gin.Context, ctx context.Context, p *model.Payment, log *logrus.Entry) {
	now := time.Now()
	if err := h.Payments.UpdateStatus(ctx, p.ID, "confirmed", nil, &now, ""); err != nil {
		log.WithError(err).Error("xendit webhook: update payment status failed")
		c.JSON(http.StatusInternalServerError, dto.Err("INTERNAL", "update payment failed", c.Request.URL.Path))
		return
	}
	p.Status = "confirmed"
	p.ConfirmedAt = &now

	// Reuse settlement logic: mark invoice paid + restore subscription via outbox.
	h.applySettlement(ctx, p)

	log.Info("xendit webhook: payment confirmed, settlement applied")
	c.JSON(http.StatusOK, gin.H{"status": "confirmed"})
}

func (h *XenditWebhook) handleExpiredOrFailed(ctx context.Context, p *model.Payment, status string, log *logrus.Entry) {
	_ = h.Payments.UpdateStatus(ctx, p.ID, "rejected", nil, nil, "xendit: "+status)
	log.WithField("new_status", "rejected").Info("xendit webhook: payment expired/failed, marked rejected")
}

// applySettlement menandai invoice paid + memulihkan subscription via outbox.
// Sama dengan applySettlement di api/handler/payments.go.
func (h *XenditWebhook) applySettlement(ctx context.Context, p *model.Payment) {
	now := time.Now()
	if err := h.Invoices.UpdateStatus(ctx, p.InvoiceID, "paid", &now); err != nil {
		h.Log.WithError(err).WithField("invoice_id", p.InvoiceID).Warn("xendit settlement: invoice update failed")
	}

	inv, err := h.Invoices.GetByID(ctx, p.InvoiceID)
	if err != nil {
		return
	}

	if h.Subs != nil {
		if sub, subErr := h.Subs.Get(ctx, inv.SubscriptionID); subErr == nil {
			switch sub.Status {
			case "isolir":
				_ = h.Subs.UpdateStatus(ctx, sub.ID, "active", nil, nil)
				_ = h.Subs.UpdateSyncStatus(ctx, sub.ID, "pending_profile_change", "xendit payment settled — restore profile")
			case "suspended":
				_ = h.Subs.UpdateStatus(ctx, sub.ID, "active", nil, nil)
				_ = h.Subs.UpdateSyncStatus(ctx, sub.ID, "pending_enable", "xendit payment settled — re-enable")
			}
		}
	}

	h.notifyPaid(ctx, inv, p)
}

func (h *XenditWebhook) notifyPaid(ctx context.Context, inv *model.Invoice, _ *model.Payment) {
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
}
