package payment

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/quiqxiq/rosmon/service/audit"
	"github.com/quiqxiq/rosmon/service/notification"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
)

// Service mengorkestrasi inisiasi pembayaran online.
//
// Arsitektur DB-driven: secret key dan konfigurasi dibaca dari system_settings
// per-request agar admin bisa mengubah konfigurasi dari UI tanpa restart server.
// Gateway adapter dibuat on-demand menggunakan secret key dari DB.
type Service struct {
	payments      store.PaymentStore
	invoices      store.InvoiceStore
	customers     store.CustomerStore
	subscriptions store.SubscriptionStore
	notification  *notification.Service
	settings      store.SettingStore
	auditLog      store.AuditLogStore
	log           *logrus.Logger
	nowFunc       func() time.Time
}

// Deps adalah container dependency untuk Service.
type Deps struct {
	Payments      store.PaymentStore
	Invoices      store.InvoiceStore
	Customers     store.CustomerStore
	Subscriptions store.SubscriptionStore
	Notification  *notification.Service
	Settings      store.SettingStore
	AuditLog      store.AuditLogStore
	Log           *logrus.Logger
	NowFunc       func() time.Time // nil → time.Now
}

// New membuat Service baru.
func New(d Deps) *Service {
	if d.NowFunc == nil {
		d.NowFunc = time.Now
	}
	if d.Log == nil {
		d.Log = logrus.New()
	}
	return &Service{
		payments:      d.Payments,
		invoices:      d.Invoices,
		customers:     d.Customers,
		subscriptions: d.Subscriptions,
		notification:  d.Notification,
		settings:      d.Settings,
		auditLog:      d.AuditLog,
		log:           d.Log,
		nowFunc:       d.NowFunc,
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
		Method:         "gateway",
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

// CreateManual mencatat pembayaran manual (cash/transfer) oleh admin.
// Pembayaran langsung status confirmed, melunasi invoice, dan memicu sync subscription.
func (s *Service) CreateManual(ctx context.Context, p *model.Payment, actorUserID *uint) (*model.Payment, error) {
	// 1. Ambil invoice + validasi.
	inv, err := s.invoices.GetByID(ctx, p.InvoiceID)
	if err != nil {
		return nil, fmt.Errorf("payment: get invoice: %w", err)
	}
	if inv.CustomerID != p.CustomerID {
		return nil, fmt.Errorf("payment: invoice %d bukan milik customer %d", p.InvoiceID, p.CustomerID)
	}
	if inv.Status == "paid" || inv.Status == "cancelled" {
		return nil, fmt.Errorf("payment: invoice sudah %s", inv.Status)
	}

	// 2. Set status dan confirmed info.
	now := s.nowFunc()
	p.Status = "confirmed"
	p.ConfirmedBy = actorUserID
	p.ConfirmedAt = &now

	// 3. Simpan ke DB.
	if err := s.payments.Create(ctx, p); err != nil {
		return nil, err // unique constraint violation will bubble up
	}

	// 4. Settle invoice & restore subscription.
	s.applySettlement(ctx, p)

	// 5. Audit log.
	audit.Log(ctx, s.auditLog, s.log, actorUserID, "payment_confirmed", "payment", p.ID, nil, p)

	return p, nil
}

// CreatePortalPayment mencatat pembayaran pending ketika pelanggan mengunggah bukti transfer manual di portal.
func (s *Service) CreatePortalPayment(ctx context.Context, invoiceID, customerID uint, proofURL, bankName, refNum string) (*model.Payment, error) {
	// 1. Ambil invoice + validasi.
	inv, err := s.invoices.GetByID(ctx, invoiceID)
	if err != nil {
		return nil, fmt.Errorf("payment: get invoice: %w", err)
	}
	if inv.CustomerID != customerID {
		return nil, fmt.Errorf("payment: invoice %d bukan milik customer %d", invoiceID, customerID)
	}
	if inv.Status == "paid" || inv.Status == "cancelled" {
		return nil, fmt.Errorf("payment: invoice sudah %s", inv.Status)
	}

	// 2. Buat Payment record pending.
	now := s.nowFunc()
	p := &model.Payment{
		InvoiceID:       invoiceID,
		CustomerID:      customerID,
		Amount:          inv.Amount,
		Method:          "portal",
		ReferenceNumber: refNum,
		ProofURL:        proofURL,
		BankName:        bankName,
		Status:          "pending",
		IdempotencyKey:  fmt.Sprintf("portal-inv%d-cust%d-%d", invoiceID, customerID, now.UnixMilli()),
	}

	// 3. Simpan ke DB.
	if err := s.payments.Create(ctx, p); err != nil {
		return nil, err
	}

	// 4. Audit log.
	audit.Log(ctx, s.auditLog, s.log, nil, "payment_uploaded", "payment", p.ID, nil, p)

	return p, nil
}

// Confirm mengonfirmasi pembayaran pending manual, menandai invoice paid, dan memulihkan subscription.
func (s *Service) Confirm(ctx context.Context, paymentID uint, actorUserID *uint) (*model.Payment, error) {
	p, err := s.payments.GetByID(ctx, paymentID)
	if err != nil {
		return nil, err
	}
	if p.Status != "pending" {
		return nil, fmt.Errorf("payment: status is already %s", p.Status)
	}

	now := s.nowFunc()
	if err := s.payments.UpdateStatus(ctx, paymentID, "confirmed", actorUserID, &now, ""); err != nil {
		return nil, err
	}
	p.Status = "confirmed"
	p.ConfirmedAt = &now
	p.ConfirmedBy = actorUserID

	// Apply settlement.
	s.applySettlement(ctx, p)

	// Audit.
	audit.Log(ctx, s.auditLog, s.log, actorUserID, "payment_confirmed", "payment", p.ID, map[string]string{"status": "pending"}, map[string]string{"status": "confirmed"})

	return p, nil
}

// Reject menolak pembayaran pending manual, mencatat alasan, dan mengirim WhatsApp notifikasi.
func (s *Service) Reject(ctx context.Context, paymentID uint, reason string, actorUserID *uint) (*model.Payment, error) {
	p, err := s.payments.GetByID(ctx, paymentID)
	if err != nil {
		return nil, err
	}
	if p.Status != "pending" {
		return nil, fmt.Errorf("payment: status is already %s", p.Status)
	}

	if err := s.payments.UpdateStatus(ctx, paymentID, "rejected", nil, nil, reason); err != nil {
		return nil, err
	}
	p.Status = "rejected"
	p.RejectionReason = reason

	// Audit.
	audit.Log(ctx, s.auditLog, s.log, actorUserID, "payment_rejected", "payment", p.ID, map[string]string{"status": "pending"}, map[string]string{"status": "rejected"})

	// WhatsApp notification.
	s.notifyRejected(ctx, p)

	return p, nil
}

// ProcessWebhook memproses callback status dari gateway (Xendit) secara idempoten.
func (s *Service) ProcessWebhook(ctx context.Context, event PaymentEvent) error {
	p, err := s.payments.GetByExternalRef(ctx, event.GatewayName, event.ExternalRef)
	if err != nil {
		return fmt.Errorf("payment: get by external ref: %w", err)
	}

	// Idempotensi: jika sudah dikonfirmasi atau ditolak, abaikan.
	if p.Status == "confirmed" || p.Status == "rejected" {
		if s.log != nil {
			s.log.Infof("payment gateway webhook: already %s, skipping", p.Status)
		}
		return nil
	}

	switch event.Status {
	case "paid":
		now := s.nowFunc()
		if err := s.payments.UpdateStatus(ctx, p.ID, "confirmed", nil, &now, ""); err != nil {
			return err
		}
		p.Status = "confirmed"
		p.ConfirmedAt = &now

		// Apply settlement.
		s.applySettlement(ctx, p)

		// Audit.
		audit.Log(ctx, s.auditLog, s.log, nil, "payment_confirmed", "payment", p.ID, map[string]string{"status": "pending"}, map[string]string{"status": "confirmed"})

	case "expired", "failed":
		if err := s.payments.UpdateStatus(ctx, p.ID, "rejected", nil, nil, "gateway: "+event.Status); err != nil {
			return err
		}
		p.Status = "rejected"
		p.RejectionReason = "gateway: " + event.Status

		// Audit.
		audit.Log(ctx, s.auditLog, s.log, nil, "payment_rejected", "payment", p.ID, map[string]string{"status": "pending"}, map[string]string{"status": "rejected"})
	}

	return nil
}

// applySettlement melakukan penyesuaian invoice paid + memulihkan status subscription ke active (via outbox).
func (s *Service) applySettlement(ctx context.Context, p *model.Payment) {
	now := s.nowFunc()
	if err := s.invoices.UpdateStatus(ctx, p.InvoiceID, "paid", &now); err != nil {
		if s.log != nil {
			s.log.WithError(err).WithField("invoice_id", p.InvoiceID).Warn("settle: invoice update failed")
		}
	}

	inv, err := s.invoices.GetByID(ctx, p.InvoiceID)
	if err != nil {
		return
	}
	restored := false
	if s.subscriptions != nil {
		if sub, subErr := s.subscriptions.Get(ctx, inv.SubscriptionID); subErr == nil {
			switch sub.Status {
			case "isolir":
				_ = s.subscriptions.UpdateStatus(ctx, sub.ID, "active", nil, nil)
				_ = s.subscriptions.UpdateSyncStatus(ctx, sub.ID, "pending_profile_change", "payment settled — restore profile")
				restored = true
			case "suspended":
				_ = s.subscriptions.UpdateStatus(ctx, sub.ID, "active", nil, nil)
				_ = s.subscriptions.UpdateSyncStatus(ctx, sub.ID, "pending_enable", "payment settled — re-enable")
				restored = true
			}
		}
	}

	s.notifyPaid(ctx, inv, restored)
}

func (s *Service) notifyPaid(ctx context.Context, inv *model.Invoice, restored bool) {
	if s.notification == nil || s.customers == nil {
		return
	}
	cust, err := s.customers.Get(ctx, inv.CustomerID)
	if err != nil || cust.Phone == "" {
		return
	}
	cid := cust.ID
	s.notification.NotifyAsync(&cid, cust.Phone, "payment_confirmed", map[string]string{
		"customer_name":  cust.FullName,
		"invoice_number": inv.InvoiceNumber,
		"amount":         rupiah(inv.Amount),
	})
	if restored {
		s.notification.NotifyAsync(&cid, cust.Phone, "service_restored", map[string]string{
			"customer_name": cust.FullName,
			"company_name":  s.settingStr(ctx, "general.company_name", ""),
		})
	}
}

func (s *Service) notifyRejected(ctx context.Context, p *model.Payment) {
	if s.notification == nil || s.customers == nil {
		return
	}
	cust, err := s.customers.Get(ctx, p.CustomerID)
	if err != nil || cust.Phone == "" {
		return
	}
	inv, err := s.invoices.GetByID(ctx, p.InvoiceID)
	if err != nil {
		return
	}
	cid := cust.ID
	s.notification.NotifyAsync(&cid, cust.Phone, "payment_rejected", map[string]string{
		"customer_name":  cust.FullName,
		"invoice_number": inv.InvoiceNumber,
		"reason":         p.RejectionReason,
	})
}

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
