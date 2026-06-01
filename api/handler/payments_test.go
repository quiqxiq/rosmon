package handler_test

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── fake InvoiceStore ────────────────────────────────────────────────────────

type fakeInvoiceStore struct {
	mu   sync.Mutex
	rows map[uint]model.Invoice
	seq  uint
}

func newFakeInvoiceStore() *fakeInvoiceStore {
	return &fakeInvoiceStore{rows: map[uint]model.Invoice{}}
}

func (f *fakeInvoiceStore) put(inv model.Invoice) model.Invoice {
	f.mu.Lock()
	defer f.mu.Unlock()
	if inv.ID == 0 {
		f.seq++
		inv.ID = f.seq
	}
	f.rows[inv.ID] = inv
	return inv
}

func (f *fakeInvoiceStore) Create(_ context.Context, inv *model.Invoice, _ []model.InvoiceItem) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.seq++
	inv.ID = f.seq
	f.rows[inv.ID] = *inv
	return nil
}
func (f *fakeInvoiceStore) GetByID(_ context.Context, id uint) (*model.Invoice, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	inv, ok := f.rows[id]
	if !ok {
		return nil, store.ErrInvoiceNotFound
	}
	return &inv, nil
}
func (f *fakeInvoiceStore) GetByPaymentCode(_ context.Context, code string) (*model.Invoice, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if code == "" {
		return nil, store.ErrInvoiceNotFound
	}
	for _, inv := range f.rows {
		if inv.PaymentCode == code {
			cp := inv
			return &cp, nil
		}
	}
	return nil, store.ErrInvoiceNotFound
}
func (f *fakeInvoiceStore) List(_ context.Context, fil store.InvoiceListFilter) ([]model.Invoice, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]model.Invoice, 0)
	for _, inv := range f.rows {
		if fil.CustomerID != 0 && inv.CustomerID != fil.CustomerID {
			continue
		}
		if fil.Status != "" && inv.Status != fil.Status {
			continue
		}
		out = append(out, inv)
	}
	return out, nil
}
func (f *fakeInvoiceStore) UpdateStatus(_ context.Context, id uint, status string, paidAt *time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	inv, ok := f.rows[id]
	if !ok {
		return store.ErrInvoiceNotFound
	}
	inv.Status = status
	inv.PaidAt = paidAt
	f.rows[id] = inv
	return nil
}
func (f *fakeInvoiceStore) ListDueForBilling(context.Context, time.Time) ([]model.Invoice, error) {
	return nil, nil
}
func (f *fakeInvoiceStore) ListOverdue(context.Context, time.Time) ([]model.Invoice, error) {
	return nil, nil
}

var _ store.InvoiceStore = (*fakeInvoiceStore)(nil)

// ── fake PaymentStore ────────────────────────────────────────────────────────

type fakePaymentStore struct {
	mu   sync.Mutex
	rows map[uint]model.Payment
	idem map[string]bool
	seq  uint
}

func newFakePaymentStore() *fakePaymentStore {
	return &fakePaymentStore{rows: map[uint]model.Payment{}, idem: map[string]bool{}}
}

func (f *fakePaymentStore) Create(_ context.Context, p *model.Payment) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if p.IdempotencyKey != "" && f.idem[p.IdempotencyKey] {
		return errors.New("UNIQUE constraint failed: payments.idempotency_key")
	}
	f.seq++
	p.ID = f.seq
	f.rows[p.ID] = *p
	if p.IdempotencyKey != "" {
		f.idem[p.IdempotencyKey] = true
	}
	return nil
}
func (f *fakePaymentStore) GetByID(_ context.Context, id uint) (*model.Payment, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	p, ok := f.rows[id]
	if !ok {
		return nil, store.ErrPaymentNotFound
	}
	return &p, nil
}
func (f *fakePaymentStore) List(_ context.Context, fil store.PaymentListFilter) ([]model.Payment, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]model.Payment, 0)
	for _, p := range f.rows {
		if fil.CustomerID != 0 && p.CustomerID != fil.CustomerID {
			continue
		}
		if fil.InvoiceID != 0 && p.InvoiceID != fil.InvoiceID {
			continue
		}
		if fil.Status != "" && p.Status != fil.Status {
			continue
		}
		out = append(out, p)
	}
	return out, nil
}
func (f *fakePaymentStore) count() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.rows)
}
func (f *fakePaymentStore) UpdateStatus(_ context.Context, id uint, status string, confirmedBy *uint, confirmedAt *time.Time, reason string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	p, ok := f.rows[id]
	if !ok {
		return store.ErrPaymentNotFound
	}
	p.Status = status
	p.ConfirmedBy = confirmedBy
	p.ConfirmedAt = confirmedAt
	p.RejectionReason = reason
	f.rows[id] = p
	return nil
}

func (f *fakePaymentStore) GetByExternalRef(_ context.Context, gatewayName, externalRef string) (*model.Payment, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, p := range f.rows {
		if p.GatewayName == gatewayName && p.ExternalRef == externalRef {
			cp := p
			return &cp, nil
		}
	}
	return nil, store.ErrPaymentNotFound
}

func (f *fakePaymentStore) UpdateGatewayInfo(_ context.Context, id uint, updates map[string]any) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	p, ok := f.rows[id]
	if !ok {
		return store.ErrPaymentNotFound
	}
	if extRef, ok := updates["external_ref"].(string); ok {
		p.ExternalRef = extRef
	}
	if invURL, ok := updates["invoice_url"].(string); ok {
		p.InvoiceURL = invURL
	}
	if expiresAt, ok := updates["expires_at"].(*time.Time); ok {
		p.ExpiresAt = expiresAt
	} else if expiresAtTime, ok := updates["expires_at"].(time.Time); ok {
		p.ExpiresAt = &expiresAtTime
	}
	if rawResp, ok := updates["gateway_response"].(string); ok {
		p.GatewayResponse = rawResp
	}
	if gatewayName, ok := updates["gateway_name"].(string); ok {
		p.GatewayName = gatewayName
	}
	f.rows[id] = p
	return nil
}

var _ store.PaymentStore = (*fakePaymentStore)(nil)

// ── tests: settle-by-code (Collect) ──────────────────────────────────────────

func setupCollectEngine(t *testing.T) (*gin.Engine, *fakeInvoiceStore, *fakePaymentStore, *fakeSubscriptionStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	invS := newFakeInvoiceStore()
	payS := newFakePaymentStore()
	subS := newFakeSubStore()
	// notif/audit/settings/customers nil → best-effort skipped.
	h := handler.NewPayments(payS, invS, subS, nil, nil, nil, nil, nil)
	r := gin.New()
	h.Register(r.Group("/api/v1"))
	return r, invS, payS, subS
}

func TestPayments_Collect_OK_RestoresIsolir(t *testing.T) {
	r, invS, payS, subS := setupCollectEngine(t)
	// Subscription in isolir (seed via Create → assigns ID).
	sub := &model.Subscription{CustomerID: 1, DeviceID: 1, ServiceType: "pppoe", MikrotikUsername: "budi", Status: "isolir", SyncStatus: "synced"}
	require.NoError(t, subS.Create(context.Background(), sub))
	invS.put(model.Invoice{InvoiceNumber: "INV-1", CustomerID: 1, SubscriptionID: sub.ID, Amount: 150000, Status: "issued", PaymentCode: "ABC23XYZ90"})

	w := doJSON(r, http.MethodPost, "/api/v1/payments/collect", map[string]any{"code": "ABC23XYZ90"})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())

	// Payment created confirmed cash.
	require.Equal(t, 1, payS.count())
	pays, _ := payS.List(context.Background(), store.PaymentListFilter{})
	require.Len(t, pays, 1)
	assert.Equal(t, "confirmed", pays[0].Status)
	assert.Equal(t, "cash", pays[0].Method)
	assert.EqualValues(t, 150000, pays[0].Amount)

	// Invoice paid.
	inv, _ := invS.GetByPaymentCode(context.Background(), "ABC23XYZ90")
	assert.Equal(t, "paid", inv.Status)

	// Subscription restored via outbox flag.
	got, _ := subS.Get(context.Background(), sub.ID)
	assert.Equal(t, "active", got.Status)
	assert.Equal(t, "pending_profile_change", got.SyncStatus)
}

func TestPayments_Collect_InvalidCode_404(t *testing.T) {
	r, _, _, _ := setupCollectEngine(t)
	w := doJSON(r, http.MethodPost, "/api/v1/payments/collect", map[string]any{"code": "NOPECODE00"})
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestPayments_Collect_AlreadyPaid_409(t *testing.T) {
	r, invS, _, _ := setupCollectEngine(t)
	invS.put(model.Invoice{ID: 1, CustomerID: 1, SubscriptionID: 1, Amount: 100000, Status: "paid", PaymentCode: "PAIDCODE00"})
	w := doJSON(r, http.MethodPost, "/api/v1/payments/collect", map[string]any{"code": "PAIDCODE00"})
	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestPayments_Collect_DoubleScan_OnlyOnePayment(t *testing.T) {
	r, invS, payS, _ := setupCollectEngine(t)
	invS.put(model.Invoice{ID: 1, CustomerID: 1, SubscriptionID: 1, Amount: 100000, Status: "issued", PaymentCode: "DUPCODE000"})

	w1 := doJSON(r, http.MethodPost, "/api/v1/payments/collect", map[string]any{"code": "DUPCODE000"})
	require.Equal(t, http.StatusCreated, w1.Code, "body: %s", w1.Body.String())

	// Second scan: invoice already paid → 409, no second payment.
	w2 := doJSON(r, http.MethodPost, "/api/v1/payments/collect", map[string]any{"code": "DUPCODE000"})
	assert.Equal(t, http.StatusConflict, w2.Code)
	assert.Equal(t, 1, payS.count())
}

func TestPayments_Collect_MissingCode_400(t *testing.T) {
	r, _, _, _ := setupCollectEngine(t)
	w := doJSON(r, http.MethodPost, "/api/v1/payments/collect", map[string]any{})
	assert.Equal(t, http.StatusBadRequest, w.Code)
}
