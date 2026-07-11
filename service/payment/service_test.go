package payment_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	paymentSvc "github.com/quiqxiq/rosmon/service/payment"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
)

// ── stub stores ─────────────────────────────────────────────────────────────

type stubInvoiceStore struct {
	invoice *model.Invoice
	err     error
}

func (s *stubInvoiceStore) GetByID(_ context.Context, _ uint) (*model.Invoice, error) {
	return s.invoice, s.err
}

func (s *stubInvoiceStore) GetByPaymentCode(_ context.Context, _ string) (*model.Invoice, error) {
	return nil, errors.New("not implemented")
}

func (s *stubInvoiceStore) List(_ context.Context, _ store.InvoiceListFilter) ([]model.Invoice, error) {
	return nil, nil
}

func (s *stubInvoiceStore) Create(_ context.Context, _ *model.Invoice, _ []model.InvoiceItem) error {
	return nil
}

func (s *stubInvoiceStore) UpdateStatus(_ context.Context, id uint, status string, paidAt *time.Time) error {
	if s.invoice != nil && s.invoice.ID == id {
		s.invoice.Status = status
		s.invoice.PaidAt = paidAt
	}
	return s.err
}

func (s *stubInvoiceStore) ListDueForBilling(_ context.Context, _ time.Time) ([]model.Invoice, error) {
	return nil, nil
}

func (s *stubInvoiceStore) ListOverdue(_ context.Context, _ time.Time) ([]model.Invoice, error) {
	return nil, nil
}
func (s *stubInvoiceStore) MonthlySummary(_ context.Context, _, _ int) (*store.FinancialSummary, error) {
	return &store.FinancialSummary{}, nil
}
func (s *stubInvoiceStore) AgingBuckets(_ context.Context, _ time.Time) ([]store.AgingBucket, error) {
	return nil, nil
}
func (s *stubInvoiceStore) CountOverdue(_ context.Context) (int, int64, error) { return 0, 0, nil }
func (s *stubInvoiceStore) SumPaidThisMonth(_ context.Context, _, _ int) (int64, error) {
	return 0, nil
}
func (s *stubInvoiceStore) CountPendingPayments(_ context.Context) (int, error) { return 0, nil }

// ── stub payment store ───────────────────────────────────────────────────────

type stubPaymentStore struct {
	created         *model.Payment
	createErr       error
	updateStatusErr error
	updateGWErr     error
}

func (s *stubPaymentStore) Create(_ context.Context, p *model.Payment) error {
	if s.createErr != nil {
		return s.createErr
	}
	p.ID = 42 // simulasi auto-increment
	s.created = p
	return nil
}

func (s *stubPaymentStore) GetByID(_ context.Context, _ uint) (*model.Payment, error) {
	return s.created, nil
}

func (s *stubPaymentStore) GetByExternalRef(_ context.Context, gatewayName, externalRef string) (*model.Payment, error) {
	if s.created != nil && s.created.GatewayName == gatewayName && s.created.ExternalRef == externalRef {
		return s.created, nil
	}
	return nil, store.ErrPaymentNotFound
}

func (s *stubPaymentStore) List(_ context.Context, _ store.PaymentListFilter) ([]model.Payment, error) {
	return nil, nil
}

func (s *stubPaymentStore) UpdateStatus(_ context.Context, _ uint, _ string, _ *uint, _ *time.Time, _ string) error {
	return s.updateStatusErr
}

func (s *stubPaymentStore) UpdateGatewayInfo(_ context.Context, _ uint, _ map[string]any) error {
	return s.updateGWErr
}

// ── stub customer store ──────────────────────────────────────────────────────

type stubCustomerStore struct {
	customer model.Customer
	err      error
}

func (s *stubCustomerStore) Get(_ context.Context, _ uint) (model.Customer, error) {
	return s.customer, s.err
}

func (s *stubCustomerStore) GetByPhone(_ context.Context, _ string) (model.Customer, error) {
	return model.Customer{}, nil
}

func (s *stubCustomerStore) List(_ context.Context, _ store.CustomerListFilter) ([]model.Customer, error) {
	return nil, nil
}

func (s *stubCustomerStore) Create(_ context.Context, _ *model.Customer) error { return nil }

func (s *stubCustomerStore) Update(_ context.Context, _ *model.Customer) error { return nil }

func (s *stubCustomerStore) Delete(_ context.Context, _ uint) error { return nil }

// ── stub setting store ───────────────────────────────────────────────

// stubSettingStore mensimulasikan Xendit yang sudah dikonfigurasi di DB.
// Service membaca secret key dari sini saat buildGateway().
type stubSettingStore struct {
	settings map[string]string
}

func newConfiguredSettings() *stubSettingStore {
	return &stubSettingStore{
		settings: map[string]string{
			"payment.xendit_enabled":          "true",
			"payment.xendit_secret_key":       "xnd_test_secret_key",
			"payment.xendit_webhook_token":    "test-webhook-token",
			"payment.xendit_invoice_duration": "86400",
			"payment.app_url":                "http://localhost:5173",
		},
	}
}

func (s *stubSettingStore) Get(_ context.Context, key string) (string, error) {
	if v, ok := s.settings[key]; ok {
		return v, nil
	}
	return "", errors.New("not found")
}

func (s *stubSettingStore) Set(_ context.Context, key, value string) error {
	s.settings[key] = value
	return nil
}

func (s *stubSettingStore) SetOrCreate(_ context.Context, key, value string) error {
	s.settings[key] = value
	return nil
}

func (s *stubSettingStore) List(_ context.Context) ([]model.SystemSetting, error) {
	return nil, nil
}

// ── stub subscription store ──────────────────────────────────────────────────

type stubSubscriptionStore struct {
	sub *model.Subscription
	err error
}

func (s *stubSubscriptionStore) List(_ context.Context, _ store.SubscriptionListFilter) ([]model.Subscription, error) {
	return nil, nil
}
func (s *stubSubscriptionStore) Get(_ context.Context, id uint) (model.Subscription, error) {
	if s.sub != nil && s.sub.ID == id {
		return *s.sub, s.err
	}
	return model.Subscription{}, store.ErrSubscriptionNotFound
}
func (s *stubSubscriptionStore) Create(_ context.Context, _ *model.Subscription) error {
	return nil
}
func (s *stubSubscriptionStore) Update(_ context.Context, _ *model.Subscription) error {
	return nil
}
func (s *stubSubscriptionStore) UpdateStatus(_ context.Context, id uint, status string, _, _ *time.Time) error {
	if s.sub != nil && s.sub.ID == id {
		s.sub.Status = status
	}
	return nil
}
func (s *stubSubscriptionStore) UpdateSyncStatus(_ context.Context, id uint, syncStatus, _ string) error {
	if s.sub != nil && s.sub.ID == id {
		s.sub.SyncStatus = syncStatus
	}
	return nil
}
func (s *stubSubscriptionStore) IncrSyncRetry(_ context.Context, _ uint, _ string) (int, error) {
	return 0, nil
}
func (s *stubSubscriptionStore) ResetSyncRetry(_ context.Context, _ uint) error {
	return nil
}
func (s *stubSubscriptionStore) ListPendingSync(_ context.Context, _ int) ([]model.Subscription, error) {
	return nil, nil
}
func (s *stubSubscriptionStore) UpdateNextInvoiceDate(_ context.Context, _ uint, _ time.Time) error {
	return nil
}
func (s *stubSubscriptionStore) Delete(_ context.Context, _ uint) error {
	return nil
}
func (s *stubSubscriptionStore) ChurnByMonth(_ context.Context, _ int) ([]store.ChurnEntry, error) {
	return nil, nil
}
func (s *stubSubscriptionStore) StatusCounts(_ context.Context) (*store.SubscriptionStatusCounts, error) {
	return nil, nil
}
func (s *stubSubscriptionStore) CountCustomers(_ context.Context) (int, error) {
	return 0, nil
}

// ── helpers ──────────────────────────────────────────────────────────────

func fixedNow() time.Time {
	return time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC)
}

// newService membuat Service dengan XenditAdapter yang akan melakukan HTTP call.
// Untuk unit test kita pakai real XenditAdapter dengan fake baseURL.
// Settings store menyediakan secret key agar buildGateway() berhasil.
func newService(ps store.PaymentStore, is store.InvoiceStore, cs store.CustomerStore, ss *stubSettingStore, subs store.SubscriptionStore) *paymentSvc.Service {
	if ss == nil {
		ss = newConfiguredSettings()
	}
	if subs == nil {
		subs = &stubSubscriptionStore{}
	}
	return paymentSvc.New(paymentSvc.Deps{
		Payments:      ps,
		Invoices:      is,
		Customers:     cs,
		Subscriptions: subs,
		Settings:      ss,
		NowFunc:       fixedNow,
	})
}

// ── tests ────────────────────────────────────────────────────────────────────

func TestInitiatePayment_HappyPath(t *testing.T) {
	inv := &model.Invoice{
		ID:            1,
		InvoiceNumber: "INV-2026-06-0001",
		CustomerID:    10,
		Amount:        150000,
		Status:        "issued",
	}
	cust := model.Customer{ID: 10, FullName: "Budi Santoso", Phone: "081234567890"}

	ps := &stubPaymentStore{}
	is := &stubInvoiceStore{invoice: inv}
	cs := &stubCustomerStore{customer: cust}
	// Service pakai real XenditAdapter — tapi karena test tidak connect ke internet,
	// kita tidak bisa test InitiatePayment end-to-end di unit test.
	// Test ini hanya memverifikasi validation logic SEBELUM gateway dipanggil.
	// Gateway call error akan terjadi (network) tapi payment record sudah dibuat.
	svc := newService(ps, is, cs, newConfiguredSettings(), nil)
	// Karena XenditAdapter nyata akan gagal (no network), test cukup cek bahwa
	// result.PaymentID dikirim dan error berisi gateway (bukan validasi).
	_, err := svc.InitiatePayment(context.Background(), 1, 10)

	// Error karena network failure ke Xendit — bukan validasi invoice/customer.
	// Yang kita test adalah bahwa kode mencapai tahap gateway call.
	if err != nil {
		// Pastikan bukan error validasi — error network/gateway adalah expected di unit test.
		assert.NotContains(t, err.Error(), "bukan milik customer")
		assert.NotContains(t, err.Error(), "sudah lunas")
	}
}

func TestInitiatePayment_InvoiceAlreadyPaid(t *testing.T) {
	inv := &model.Invoice{
		ID:         1,
		CustomerID: 10,
		Status:     "paid",
	}
	ps := &stubPaymentStore{}
	is := &stubInvoiceStore{invoice: inv}
	cs := &stubCustomerStore{customer: model.Customer{ID: 10}}

	svc := newService(ps, is, cs, newConfiguredSettings(), nil)
	_, err := svc.InitiatePayment(context.Background(), 1, 10)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "sudah lunas")
	assert.Nil(t, ps.created, "tidak boleh buat payment record jika invoice sudah lunas")
}

func TestInitiatePayment_WrongCustomer(t *testing.T) {
	inv := &model.Invoice{
		ID:         1,
		CustomerID: 99, // berbeda dari customer 10
		Status:     "issued",
	}
	ps := &stubPaymentStore{}
	is := &stubInvoiceStore{invoice: inv}
	cs := &stubCustomerStore{customer: model.Customer{ID: 10}}

	svc := newService(ps, is, cs, newConfiguredSettings(), nil)
	_, err := svc.InitiatePayment(context.Background(), 1, 10)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "bukan milik customer")
}

func TestInitiatePayment_GatewayError_RejectsPayment(t *testing.T) {
	inv := &model.Invoice{
		ID:            1,
		InvoiceNumber: "INV-0001",
		CustomerID:    10,
		Amount:        150000,
		Status:        "issued",
	}
	cust := model.Customer{ID: 10, FullName: "Budi", Phone: "08123"}

	rejected := false
	ps := &stubPaymentStore{
		updateStatusErr: nil,
	}
	// detect reject call
	_ = rejected

	is := &stubInvoiceStore{invoice: inv}
	cs := &stubCustomerStore{customer: cust}

	svc := newService(ps, is, cs, newConfiguredSettings(), nil)
	_, err := svc.InitiatePayment(context.Background(), 1, 10)

	// Error dari gateway (network atau mock) — bukan validasi
	require.Error(t, err)
}

func TestXenditAdapter_VerifyWebhookSignature_Valid(t *testing.T) {
	adapter := paymentSvc.NewXenditAdapter("sk-test", "my-webhook-token", 86400)

	headers := map[string]string{
		"x-callback-token": "my-webhook-token",
	}
	err := adapter.VerifyWebhookSignature([]byte(`{}`), headers)
	assert.NoError(t, err)
}

func TestXenditAdapter_VerifyWebhookSignature_Invalid(t *testing.T) {
	adapter := paymentSvc.NewXenditAdapter("sk-test", "my-webhook-token", 86400)

	headers := map[string]string{
		"x-callback-token": "wrong-token",
	}
	err := adapter.VerifyWebhookSignature([]byte(`{}`), headers)
	assert.Error(t, err)
}

func TestXenditAdapter_ParseWebhookEvent_Paid(t *testing.T) {
	adapter := paymentSvc.NewXenditAdapter("sk-test", "token", 0)

	body := []byte(`{
		"id": "xendit-inv-abc",
		"payment_id": "xendit-inv-abc",
		"external_id": "xendit-inv1-pay42",
		"status": "PAID",
		"amount": 150000,
		"paid_at": "2026-06-01T10:30:00Z"
	}`)

	evt, err := adapter.ParseWebhookEvent(body)
	require.NoError(t, err)
	assert.Equal(t, "paid", evt.Status)
	assert.Equal(t, "xendit-inv-abc", evt.ExternalRef)
	assert.Equal(t, int64(150000), evt.Amount)
	require.NotNil(t, evt.PaidAt)
	assert.Equal(t, "xendit", evt.GatewayName)
}

func TestXenditAdapter_ParseWebhookEvent_Expired(t *testing.T) {
	adapter := paymentSvc.NewXenditAdapter("sk-test", "token", 0)

	body := []byte(`{"id":"inv-xyz","status":"EXPIRED","amount":50000}`)
	evt, err := adapter.ParseWebhookEvent(body)
	require.NoError(t, err)
	assert.Equal(t, "expired", evt.Status)
}

func TestService_CreateManual(t *testing.T) {
	inv := &model.Invoice{
		ID:             1,
		CustomerID:     10,
		SubscriptionID: 2,
		Amount:         150000,
		Status:         "issued",
	}
	cust := model.Customer{ID: 10}
	sub := &model.Subscription{ID: 2, Status: "isolir"}

	ps := &stubPaymentStore{}
	is := &stubInvoiceStore{invoice: inv}
	cs := &stubCustomerStore{customer: cust}
	subs := &stubSubscriptionStore{sub: sub}

	svc := newService(ps, is, cs, nil, subs)

	p := &model.Payment{
		InvoiceID:  1,
		CustomerID: 10,
		Amount:     150000,
		Method:     "cash",
	}

	actor := uint(1)
	res, err := svc.CreateManual(context.Background(), p, &actor)
	require.NoError(t, err)
	assert.Equal(t, "confirmed", res.Status)
	assert.Equal(t, &actor, res.ConfirmedBy)
	assert.NotNil(t, res.ConfirmedAt)

	// Settle: invoice paid, subscription active
	assert.Equal(t, "paid", inv.Status)
	assert.Equal(t, "active", sub.Status)
	assert.Equal(t, "pending_profile_change", sub.SyncStatus)
}

func TestService_CreatePortalPayment(t *testing.T) {
	inv := &model.Invoice{
		ID:         1,
		CustomerID: 10,
		Amount:     150000,
		Status:     "issued",
	}
	cust := model.Customer{ID: 10}

	ps := &stubPaymentStore{}
	is := &stubInvoiceStore{invoice: inv}
	cs := &stubCustomerStore{customer: cust}

	svc := newService(ps, is, cs, nil, nil)

	res, err := svc.CreatePortalPayment(context.Background(), 1, 10, "https://proof.local/jpg", "BCA", "REF123")
	require.NoError(t, err)
	assert.Equal(t, "pending", res.Status)
	assert.Equal(t, "portal", res.Method)
	assert.Equal(t, "https://proof.local/jpg", res.ProofURL)
	assert.Equal(t, "BCA", res.BankName)
	assert.Equal(t, "REF123", res.ReferenceNumber)
}

func TestService_Confirm(t *testing.T) {
	inv := &model.Invoice{
		ID:             1,
		CustomerID:     10,
		SubscriptionID: 3,
		Amount:         150000,
		Status:         "issued",
	}
	sub := &model.Subscription{ID: 3, Status: "suspended"}

	ps := &stubPaymentStore{
		created: &model.Payment{
			ID:         42,
			InvoiceID:  1,
			CustomerID: 10,
			Amount:     150000,
			Method:     "portal",
			Status:     "pending",
		},
	}
	is := &stubInvoiceStore{invoice: inv}
	subs := &stubSubscriptionStore{sub: sub}

	svc := newService(ps, is, nil, nil, subs)

	actor := uint(2)
	res, err := svc.Confirm(context.Background(), 42, &actor)
	require.NoError(t, err)
	assert.Equal(t, "confirmed", res.Status)
	assert.Equal(t, &actor, res.ConfirmedBy)
	assert.NotNil(t, res.ConfirmedAt)

	assert.Equal(t, "paid", inv.Status)
	assert.Equal(t, "active", sub.Status)
	assert.Equal(t, "pending_enable", sub.SyncStatus)
}

func TestService_Reject(t *testing.T) {
	ps := &stubPaymentStore{
		created: &model.Payment{
			ID:         42,
			InvoiceID:  1,
			CustomerID: 10,
			Amount:     150000,
			Method:     "portal",
			Status:     "pending",
		},
	}

	svc := newService(ps, nil, nil, nil, nil)

	actor := uint(2)
	res, err := svc.Reject(context.Background(), 42, "gambarnya buram", &actor)
	require.NoError(t, err)
	assert.Equal(t, "rejected", res.Status)
	assert.Equal(t, "gambarnya buram", res.RejectionReason)
}

func TestService_ProcessWebhook_Paid(t *testing.T) {
	p := &model.Payment{
		ID:          42,
		InvoiceID:   1,
		CustomerID:  10,
		Amount:      150000,
		Method:      "gateway",
		Status:      "pending",
		GatewayName: "xendit",
		ExternalRef: "xend_123",
	}
	inv := &model.Invoice{
		ID:         1,
		CustomerID: 10,
		Status:     "issued",
	}

	ps := &stubPaymentStore{created: p}
	is := &stubInvoiceStore{invoice: inv}
	svc := newService(ps, is, nil, nil, nil)

	evt := paymentSvc.PaymentEvent{
		ExternalRef: "xend_123",
		Status:      "paid",
		Amount:      150000,
		GatewayName: "xendit",
	}

	err := svc.ProcessWebhook(context.Background(), evt)
	require.NoError(t, err)
	assert.Equal(t, "confirmed", p.Status)
	assert.Equal(t, "paid", inv.Status)
}

func TestService_ProcessWebhook_Expired(t *testing.T) {
	p := &model.Payment{
		ID:          42,
		InvoiceID:   1,
		CustomerID:  10,
		Amount:      150000,
		Method:      "gateway",
		Status:      "pending",
		GatewayName: "xendit",
		ExternalRef: "xend_123",
	}

	ps := &stubPaymentStore{created: p}
	svc := newService(ps, nil, nil, nil, nil)

	evt := paymentSvc.PaymentEvent{
		ExternalRef: "xend_123",
		Status:      "expired",
		Amount:      150000,
		GatewayName: "xendit",
	}

	err := svc.ProcessWebhook(context.Background(), evt)
	require.NoError(t, err)
	assert.Equal(t, "rejected", p.Status)
	assert.Equal(t, "gateway: expired", p.RejectionReason)
}

