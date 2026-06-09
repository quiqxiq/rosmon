package payment

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
)

// Service mengorkestrasi inisiasi pembayaran online.
//
// Arsitektur DB-driven: secret key dan konfigurasi dibaca dari system_settings
// per-request agar admin bisa mengubah konfigurasi dari UI tanpa restart server.
// Gateway adapter dibuat on-demand menggunakan secret key dari DB.
type Service struct {
	payments  store.PaymentStore
	invoices  store.InvoiceStore
	customers store.CustomerStore
	settings  store.SettingStore
	nowFunc   func() time.Time
}

// Deps adalah container dependency untuk Service.
type Deps struct {
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
		payments:  d.Payments,
		invoices:  d.Invoices,
		customers: d.Customers,
		settings:  d.Settings,
		nowFunc:   d.NowFunc,
	}
}

// buildGateway membaca konfigurasi Xendit dari DB dan membuat adapter baru.
// Mengembalikan error jika payment gateway tidak diaktifkan atau belum dikonfigurasi.
func (s *Service) buildGateway(ctx context.Context) (*XenditAdapter, error) {
	enabled := s.settingStr(ctx, "payment.xendit_enabled", "false")
	if enabled != "true" {
		return nil, fmt.Errorf("payment gateway Xendit belum diaktifkan (setting payment.xendit_enabled)")
	}
	secretKey := s.settingStr(ctx, "payment.xendit_secret_key", "")
	if strings.TrimSpace(secretKey) == "" {
		return nil, fmt.Errorf("payment gateway belum dikonfigurasi: secret key kosong")
	}
	webhookToken := s.settingStr(ctx, "payment.xendit_webhook_token", "")
	duration := s.settingInt(ctx, "payment.xendit_invoice_duration", 86400)
	return NewXenditAdapter(secretKey, webhookToken, duration), nil
}

// IsEnabled mengembalikan true jika gateway Xendit aktif dan secret key tersedia.
func (s *Service) IsEnabled(ctx context.Context) bool {
	_, err := s.buildGateway(ctx)
	return err == nil
}

// InitiatePaymentResult adalah output dari InitiatePayment.
type InitiatePaymentResult struct {
	PaymentID  uint
	InvoiceURL string
	ExpiresAt  time.Time
}

// InitiatePayment membuat link pembayaran Xendit untuk invoice tertentu.
// customerID dipakai untuk validasi ownership (anti-IDOR).
func (s *Service) InitiatePayment(ctx context.Context, invoiceID, customerID uint) (InitiatePaymentResult, error) {
	gw, err := s.buildGateway(ctx)
	if err != nil {
		return InitiatePaymentResult{}, err
	}

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
	idempotencyKey := fmt.Sprintf("xendit-inv%d-%d", invoiceID, now.UnixMilli())
	p := &model.Payment{
		InvoiceID:      invoiceID,
		CustomerID:     customerID,
		Amount:         inv.Amount,
		Method:         "xendit",
		Status:         "pending",
		GatewayName:    "xendit",
		IdempotencyKey: idempotencyKey,
	}
	if err := s.payments.Create(ctx, p); err != nil {
		return InitiatePaymentResult{}, fmt.Errorf("payment: create payment record: %w", err)
	}

	// 4. Baca settings untuk URL redirect.
	appURL := s.settingStr(ctx, "payment.app_url", "")
	successURL := appURL + "/portal/invoices/" + strconv.FormatUint(uint64(invoiceID), 10) + "?status=paid"
	failureURL := appURL + "/portal/invoices/" + strconv.FormatUint(uint64(invoiceID), 10) + "?status=failed"

	// 5. Panggil gateway.
	gwReq := CreateInvoiceRequest{
		ExternalID:    fmt.Sprintf("xendit-inv%d-pay%d", invoiceID, p.ID),
		Amount:        inv.Amount,
		Description:   fmt.Sprintf("Tagihan %s", inv.InvoiceNumber),
		CustomerName:  cust.FullName,
		CustomerPhone: cust.Phone,
		SuccessURL:    successURL,
		FailureURL:    failureURL,
	}
	result, err := gw.CreateInvoice(ctx, gwReq)
	if err != nil {
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
	_ = s.payments.UpdateGatewayInfo(ctx, p.ID, updates)
	p.ExternalRef = result.ExternalRef
	p.InvoiceURL = result.InvoiceURL
	p.ExpiresAt = &result.ExpiresAt

	return InitiatePaymentResult{
		PaymentID:  p.ID,
		InvoiceURL: result.InvoiceURL,
		ExpiresAt:  result.ExpiresAt,
	}, nil
}

// BuildGatewayForWebhook membuat adapter untuk memproses webhook.
// Dipanggil oleh webhook handler — tidak perlu payment.xendit_enabled = true
// karena webhook bisa datang sebelum admin mengaktifkan dari UI.
func (s *Service) BuildGatewayForWebhook(ctx context.Context) (*XenditAdapter, error) {
	secretKey := s.settingStr(ctx, "payment.xendit_secret_key", "")
	webhookToken := s.settingStr(ctx, "payment.xendit_webhook_token", "")
	if strings.TrimSpace(secretKey) == "" && strings.TrimSpace(webhookToken) == "" {
		return nil, fmt.Errorf("xendit not configured")
	}
	return NewXenditAdapter(secretKey, webhookToken, 0), nil
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
