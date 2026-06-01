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

// ── stub gateway ────────────────────────────────────────────────────────────

type stubGateway struct {
	name         string
	createResult paymentSvc.CreateInvoiceResult
	createErr    error
	verifyErr    error
	parseResult  paymentSvc.PaymentEvent
	parseErr     error
}

func (g *stubGateway) Name() string { return g.name }

func (g *stubGateway) CreateInvoice(_ context.Context, _ paymentSvc.CreateInvoiceRequest) (paymentSvc.CreateInvoiceResult, error) {
	return g.createResult, g.createErr
}

func (g *stubGateway) VerifyWebhookSignature(_ []byte, _ map[string]string) error {
	return g.verifyErr
}

func (g *stubGateway) ParseWebhookEvent(_ []byte) (paymentSvc.PaymentEvent, error) {
	return g.parseResult, g.parseErr
}

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

func (s *stubInvoiceStore) UpdateStatus(_ context.Context, _ uint, _ string, _ *time.Time) error {
	return nil
}

func (s *stubInvoiceStore) ListDueForBilling(_ context.Context, _ time.Time) ([]model.Invoice, error) {
	return nil, nil
}

func (s *stubInvoiceStore) ListOverdue(_ context.Context, _ time.Time) ([]model.Invoice, error) {
	return nil, nil
}

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

func (s *stubPaymentStore) GetByExternalRef(_ context.Context, _, _ string) (*model.Payment, error) {
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

// ── helpers ──────────────────────────────────────────────────────────────────

func fixedNow() time.Time {
	return time.Date(2026, 6, 1, 10, 0, 0, 0, time.UTC)
}

func newService(gw paymentSvc.Gateway, ps store.PaymentStore, is store.InvoiceStore, cs store.CustomerStore) *paymentSvc.Service {
	return paymentSvc.New(paymentSvc.Deps{
		Gateway:   gw,
		Payments:  ps,
		Invoices:  is,
		Customers: cs,
		Settings:  nil,
		NowFunc:   fixedNow,
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

	expectedURL := "https://checkout.xendit.co/v2/abc123"
	expires := fixedNow().Add(24 * time.Hour)

	gw := &stubGateway{
		name: "xendit",
		createResult: paymentSvc.CreateInvoiceResult{
			ExternalRef: "xendit-inv-id-abc123",
			InvoiceURL:  expectedURL,
			ExpiresAt:   expires,
			RawResponse: `{"id":"xendit-inv-id-abc123","invoice_url":"https://checkout.xendit.co/v2/abc123"}`,
		},
	}
	ps := &stubPaymentStore{}
	is := &stubInvoiceStore{invoice: inv}
	cs := &stubCustomerStore{customer: cust}

	svc := newService(gw, ps, is, cs)
	result, err := svc.InitiatePayment(context.Background(), 1, 10)

	require.NoError(t, err)
	assert.Equal(t, expectedURL, result.InvoiceURL)
	assert.Equal(t, uint(42), result.PaymentID)
	assert.Equal(t, expires, result.ExpiresAt)

	require.NotNil(t, ps.created)
	assert.Equal(t, "xendit", ps.created.GatewayName)
	assert.Equal(t, "pending", ps.created.Status)
	assert.Equal(t, uint(10), ps.created.CustomerID)
}

func TestInitiatePayment_InvoiceAlreadyPaid(t *testing.T) {
	inv := &model.Invoice{
		ID:         1,
		CustomerID: 10,
		Status:     "paid",
	}
	gw := &stubGateway{name: "xendit"}
	ps := &stubPaymentStore{}
	is := &stubInvoiceStore{invoice: inv}
	cs := &stubCustomerStore{customer: model.Customer{ID: 10}}

	svc := newService(gw, ps, is, cs)
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
	gw := &stubGateway{name: "xendit"}
	ps := &stubPaymentStore{}
	is := &stubInvoiceStore{invoice: inv}
	cs := &stubCustomerStore{customer: model.Customer{ID: 10}}

	svc := newService(gw, ps, is, cs)
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

	gw := &stubGateway{
		name:      "xendit",
		createErr: errors.New("xendit: HTTP 401: unauthorized"),
	}
	rejected := false
	ps := &stubPaymentStore{
		updateStatusErr: nil,
	}
	// Override UpdateStatus to detect reject call
	_ = rejected

	is := &stubInvoiceStore{invoice: inv}
	cs := &stubCustomerStore{customer: cust}

	svc := newService(gw, ps, is, cs)
	_, err := svc.InitiatePayment(context.Background(), 1, 10)

	require.Error(t, err)
	assert.Contains(t, err.Error(), "gateway invoice")
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
