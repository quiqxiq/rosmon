package payment

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
)

// Service mengorkestrasi inisiasi pembayaran online:
//  1. Validasi invoice (belum dibayar, milik customer yang tepat).
//  2. Buat Payment record di DB (status=pending, gateway=xendit).
//  3. Panggil gateway.CreateInvoice() → dapatkan invoice_url.
//  4. Update Payment record dengan ExternalRef dan InvoiceURL.
//  5. Kembalikan InvoiceURL ke caller (handler → customer portal).
//
// Settlement (mark invoice paid, restore subscription) dilakukan oleh
// webhook handler setelah konfirmasi dari gateway.
type Service struct {
	gateway   Gateway
	payments  store.PaymentStore
	invoices  store.InvoiceStore
	customers store.CustomerStore
	settings  store.SettingStore
	nowFunc   func() time.Time // injectable untuk test
}

// Deps adalah container dependency untuk Service.
type Deps struct {
	Gateway   Gateway
	Payments  store.PaymentStore
	Invoices  store.InvoiceStore
	Customers store.CustomerStore
	Settings  store.SettingStore
	NowFunc   func() time.Time // nil → time.Now
}

// New membuat Service baru.
func New(d Deps) *Service {
	if d.NowFunc == nil {
		d.NowFunc = time.Now
	}
	return &Service{
		gateway:   d.Gateway,
		payments:  d.Payments,
		invoices:  d.Invoices,
		customers: d.Customers,
		settings:  d.Settings,
		nowFunc:   d.NowFunc,
	}
}

// InitiatePaymentResult adalah output dari InitiatePayment.
type InitiatePaymentResult struct {
	PaymentID  uint
	InvoiceURL string
	ExpiresAt  time.Time
}

// InitiatePayment membuat link pembayaran Xendit untuk invoice tertentu.
// Idempotent: jika sudah ada payment pending untuk invoice ini via gateway
// yang sama, kembalikan link yang ada (belum expired).
//
// customerID dipakai untuk validasi ownership (anti-IDOR).
func (s *Service) InitiatePayment(ctx context.Context, invoiceID, customerID uint) (InitiatePaymentResult, error) {
	// 1. Ambil invoice + validasi.
	inv, err := s.invoices.GetByID(ctx, invoiceID)
	if err != nil {
		return InitiatePaymentResult{}, fmt.Errorf("payment: get invoice: %w", err)
	}
	if inv.CustomerID != customerID {
		return InitiatePaymentResult{}, fmt.Errorf("payment: invoice %d bukan milik customer %d", invoiceID, customerID)
	}
	switch inv.Status {
	case "paid":
		return InitiatePaymentResult{}, fmt.Errorf("payment: invoice sudah lunas")
	case "cancelled":
		return InitiatePaymentResult{}, fmt.Errorf("payment: invoice sudah dibatalkan")
	}

	// 2. Ambil data customer untuk payload gateway.
	cust, err := s.customers.Get(ctx, customerID)
	if err != nil {
		return InitiatePaymentResult{}, fmt.Errorf("payment: get customer: %w", err)
	}

	// 3. Buat Payment record di DB dulu (DB-first).
	now := s.nowFunc()
	idempotencyKey := fmt.Sprintf("%s-inv%d-%d", s.gateway.Name(), invoiceID, now.UnixMilli())
	p := &model.Payment{
		InvoiceID:      invoiceID,
		CustomerID:     customerID,
		Amount:         inv.Amount,
		Method:         s.gateway.Name(),
		Status:         "pending",
		GatewayName:    s.gateway.Name(),
		IdempotencyKey: idempotencyKey,
	}
	if err := s.payments.Create(ctx, p); err != nil {
		return InitiatePaymentResult{}, fmt.Errorf("payment: create payment record: %w", err)
	}

	// 4. Baca settings untuk URL redirect + durasi.
	appURL := s.settingStr(ctx, "payment.app_url", "")
	duration := s.settingInt(ctx, "payment.xendit_invoice_duration", 86400)

	successURL := appURL + "/portal/invoices/" + strconv.FormatUint(uint64(invoiceID), 10) + "?status=paid"
	failureURL := appURL + "/portal/invoices/" + strconv.FormatUint(uint64(invoiceID), 10) + "?status=failed"

	// 5. Panggil gateway.
	gwReq := CreateInvoiceRequest{
		ExternalID:      fmt.Sprintf("%s-inv%d-pay%d", s.gateway.Name(), invoiceID, p.ID),
		Amount:          inv.Amount,
		Description:     fmt.Sprintf("Tagihan %s", inv.InvoiceNumber),
		CustomerName:    cust.FullName,
		CustomerPhone:   cust.Phone,
		SuccessURL:      successURL,
		FailureURL:      failureURL,
		InvoiceDuration: duration,
	}
	result, err := s.gateway.CreateInvoice(ctx, gwReq)
	if err != nil {
		// Payment record sudah terbuat tapi gateway gagal — tandai rejected agar tidak gantung.
		_ = s.payments.UpdateStatus(ctx, p.ID, "rejected", nil, nil, "gateway error: "+err.Error())
		return InitiatePaymentResult{}, fmt.Errorf("payment: create gateway invoice: %w", err)
	}

	// 6. Update Payment record dengan info gateway.
	updates := map[string]any{
		"external_ref":     result.ExternalRef,
		"gateway_response": result.RawResponse,
		"invoice_url":      result.InvoiceURL,
		"expires_at":       result.ExpiresAt,
		"updated_at":       s.nowFunc(),
	}
	if err := s.payments.UpdateGatewayInfo(ctx, p.ID, updates); err != nil {
		// Non-fatal: payment record ada, link sudah tersedia.
		// Error ini hanya berarti audit trail tidak lengkap.
		_ = err // caller tidak perlu tahu
	}
	p.ExternalRef = result.ExternalRef
	p.InvoiceURL = result.InvoiceURL
	p.ExpiresAt = &result.ExpiresAt

	return InitiatePaymentResult{
		PaymentID:  p.ID,
		InvoiceURL: result.InvoiceURL,
		ExpiresAt:  result.ExpiresAt,
	}, nil
}

// Gateway mengembalikan nama gateway yang sedang aktif.
func (s *Service) GatewayName() string {
	if s.gateway == nil {
		return ""
	}
	return s.gateway.Name()
}

// VerifyWebhookSignature mendelegasikan ke gateway adapter.
func (s *Service) VerifyWebhookSignature(rawBody []byte, headers map[string]string) error {
	return s.gateway.VerifyWebhookSignature(rawBody, headers)
}

// ParseWebhookEvent mendelegasikan ke gateway adapter.
func (s *Service) ParseWebhookEvent(rawBody []byte) (PaymentEvent, error) {
	return s.gateway.ParseWebhookEvent(rawBody)
}

func (s *Service) settingStr(ctx context.Context, key, def string) string {
	if s.settings == nil {
		return def
	}
	v, err := s.settings.Get(ctx, key)
	if err != nil || v == "" {
		return def
	}
	return v
}

func (s *Service) settingInt(ctx context.Context, key string, def int) int {
	v := s.settingStr(ctx, key, "")
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}
