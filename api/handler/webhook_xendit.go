package handler

import (
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	paymentSvc "github.com/quiqxiq/rosmon/service/payment"
	"github.com/quiqxiq/rosmon/service/notification"
	"github.com/quiqxiq/rosmon/store"
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

	ctx := c.Request.Context()

	// 2. Build adapter on-demand dari DB settings.
	adapter, err := h.PaymentSvc.BuildGatewayForWebhook(ctx)
	if err != nil {
		h.Log.WithError(err).Warn("xendit webhook: gateway not configured")
		c.JSON(http.StatusOK, gin.H{"status": "ignored", "message": "gateway not configured"})
		return
	}

	// 3. Kumpulkan semua header (lowercase key) untuk verifikasi.
	headers := make(map[string]string, len(c.Request.Header))
	for k, v := range c.Request.Header {
		if len(v) > 0 {
			headers[strings.ToLower(k)] = v[0]
		}
	}

	// 4. Verifikasi signature webhook.
	if verifyErr := adapter.VerifyWebhookSignature(rawBody, headers); verifyErr != nil {
		h.Log.WithError(verifyErr).Warn("xendit webhook: signature invalid")
		c.JSON(http.StatusUnauthorized, dto.Err("UNAUTHORIZED", "invalid callback token", c.Request.URL.Path))
		return
	}

	// 5. Parse event.
	evt, err := adapter.ParseWebhookEvent(rawBody)
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

	// Process payment webhook in the service layer.
	if err := h.PaymentSvc.ProcessWebhook(ctx, evt); err != nil {
		if errors.Is(err, store.ErrPaymentNotFound) {
			log.Warn("xendit webhook: payment not found for external_ref")
			c.JSON(http.StatusOK, gin.H{"status": "unknown", "message": "payment not found"})
			return
		}
		log.WithError(err).Error("xendit webhook: processing failed")
		c.JSON(http.StatusInternalServerError, dto.Err("INTERNAL", "internal error", c.Request.URL.Path))
		return
	}

	log.Infof("xendit webhook: successfully processed status %s", evt.Status)
	c.JSON(http.StatusOK, gin.H{"status": evt.Status})
}
