package billing_test

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/quiqxiq/rosmon/service/billing"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── fakes (hanya metode yang dipakai yang berperilaku nyata) ───────────────

type fakeInvoiceStore struct {
	created []*model.Invoice
	items   [][]model.InvoiceItem
}

func (f *fakeInvoiceStore) Create(_ context.Context, inv *model.Invoice, items []model.InvoiceItem) error {
	inv.ID = uint(len(f.created) + 1)
	f.created = append(f.created, inv)
	f.items = append(f.items, items)
	return nil
}
func (f *fakeInvoiceStore) GetByID(context.Context, uint) (*model.Invoice, error) {
	return nil, store.ErrInvoiceNotFound
}
func (f *fakeInvoiceStore) GetByPaymentCode(context.Context, string) (*model.Invoice, error) {
	return nil, store.ErrInvoiceNotFound
}
func (f *fakeInvoiceStore) List(context.Context, store.InvoiceListFilter) ([]model.Invoice, error) {
	return nil, nil
}
func (f *fakeInvoiceStore) UpdateStatus(context.Context, uint, string, *time.Time) error { return nil }
func (f *fakeInvoiceStore) ListDueForBilling(context.Context, time.Time) ([]model.Invoice, error) {
	return nil, nil
}
func (f *fakeInvoiceStore) ListOverdue(context.Context, time.Time) ([]model.Invoice, error) {
	return nil, nil
}
func (f *fakeInvoiceStore) MonthlySummary(context.Context, int, int) (*store.FinancialSummary, error) {
	return &store.FinancialSummary{}, nil
}
func (f *fakeInvoiceStore) AgingBuckets(context.Context, time.Time) ([]store.AgingBucket, error) {
	return nil, nil
}
func (f *fakeInvoiceStore) CountOverdue(context.Context) (int, int64, error) { return 0, 0, nil }
func (f *fakeInvoiceStore) SumPaidThisMonth(context.Context, int, int) (int64, error) { return 0, nil }
func (f *fakeInvoiceStore) CountPendingPayments(context.Context) (int, error) { return 0, nil }

var _ store.InvoiceStore = (*fakeInvoiceStore)(nil)

type fakeSeqStore struct{ n int }

func (f *fakeSeqStore) NextVal(context.Context, string, int, int) (int, error) {
	f.n++
	return f.n, nil
}
func (f *fakeSeqStore) FormatNumber(prefix string, year, month, value int) string {
	return fmt.Sprintf("%s-%04d-%02d-%04d", prefix, year, month, value)
}

var _ store.SequenceStore = (*fakeSeqStore)(nil)

type fakePPPStore struct{ profiles map[uint]model.PPPProfile }

func (f *fakePPPStore) Get(_ context.Context, id uint) (model.PPPProfile, error) {
	p, ok := f.profiles[id]
	if !ok {
		return p, store.ErrPPPProfileNotFound
	}
	return p, nil
}
func (f *fakePPPStore) ListByDevice(context.Context, uint) ([]model.PPPProfile, error) {
	return nil, nil
}
func (f *fakePPPStore) ListPublic(context.Context) ([]model.PPPProfile, error) {
	return nil, nil
}
func (f *fakePPPStore) GetByName(context.Context, uint, string) (model.PPPProfile, error) {
	return model.PPPProfile{}, store.ErrPPPProfileNotFound
}
func (f *fakePPPStore) Create(context.Context, *model.PPPProfile) error         { return nil }
func (f *fakePPPStore) Update(context.Context, *model.PPPProfile) error         { return nil }
func (f *fakePPPStore) Delete(context.Context, uint) error                      { return nil }
func (f *fakePPPStore) Upsert(context.Context, *model.PPPProfile) (bool, error) { return false, nil }

var _ store.PPPProfileStore = (*fakePPPStore)(nil)

type fakeHotspotStore struct{ profiles map[uint]model.HotspotProfile }

func (f *fakeHotspotStore) Get(_ context.Context, id uint) (model.HotspotProfile, error) {
	p, ok := f.profiles[id]
	if !ok {
		return p, store.ErrHotspotProfileNotFound
	}
	return p, nil
}
func (f *fakeHotspotStore) ListByDevice(context.Context, uint, store.HotspotProfileListFilter) ([]model.HotspotProfile, error) {
	return nil, nil
}
func (f *fakeHotspotStore) ListPublic(context.Context) ([]model.HotspotProfile, error) {
	return nil, nil
}
func (f *fakeHotspotStore) GetByName(context.Context, uint, string) (model.HotspotProfile, error) {
	return model.HotspotProfile{}, store.ErrHotspotProfileNotFound
}
func (f *fakeHotspotStore) Create(context.Context, *model.HotspotProfile) error { return nil }
func (f *fakeHotspotStore) Update(context.Context, *model.HotspotProfile) error { return nil }
func (f *fakeHotspotStore) Delete(context.Context, uint) error                  { return nil }
func (f *fakeHotspotStore) Upsert(context.Context, *model.HotspotProfile) (bool, error) {
	return false, nil
}

var _ store.HotspotProfileStore = (*fakeHotspotStore)(nil)

// ── tests ──────────────────────────────────────────────────────────────────

func newBillingSvc(inv *fakeInvoiceStore, ppp *fakePPPStore, hs *fakeHotspotStore) *billing.Service {
	return billing.New(billing.Deps{
		Invoices:  inv,
		Sequences: &fakeSeqStore{},
		PPP:       ppp,
		Hotspot:   hs,
		NowFunc:   func() time.Time { return time.Date(2026, 5, 10, 9, 0, 0, 0, time.UTC) },
	})
}

func TestGenerateForSubscription_PPPoE(t *testing.T) {
	inv := &fakeInvoiceStore{}
	pid := uint(7)
	ppp := &fakePPPStore{profiles: map[uint]model.PPPProfile{7: {ID: 7, Name: "Paket10M", PriceMonthly: 150000}}}
	svc := newBillingSvc(inv, ppp, &fakeHotspotStore{})

	sub := model.Subscription{ID: 1, CustomerID: 3, ServiceType: "pppoe", PPPProfileID: &pid}
	periodStart := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)

	got, err := svc.GenerateForSubscription(context.Background(), sub, periodStart, 7)
	require.NoError(t, err)
	require.Len(t, inv.created, 1)
	assert.Equal(t, "INV-2026-05-0001", got.InvoiceNumber)
	assert.Equal(t, int64(150000), got.Amount)
	assert.Equal(t, "issued", got.Status)
	assert.Equal(t, periodStart.AddDate(0, 1, -1), got.PeriodEnd)
	assert.Equal(t, periodStart.AddDate(0, 0, 7), got.DueDate)
	require.NotNil(t, got.IssuedAt)
	require.Len(t, inv.items[0], 1)
	assert.Contains(t, inv.items[0][0].Description, "Paket10M")
	assert.Equal(t, int64(150000), inv.items[0][0].Amount)
}

func TestGenerateForSubscription_Hotspot(t *testing.T) {
	inv := &fakeInvoiceStore{}
	hid := uint(9)
	hs := &fakeHotspotStore{profiles: map[uint]model.HotspotProfile{9: {ID: 9, Name: "HS-Bulanan", PriceMonthly: 99000}}}
	svc := newBillingSvc(inv, &fakePPPStore{}, hs)

	sub := model.Subscription{ID: 2, CustomerID: 4, ServiceType: "hotspot", HotspotProfileID: &hid}
	got, err := svc.GenerateForSubscription(context.Background(), sub, time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC), 5)
	require.NoError(t, err)
	assert.Equal(t, int64(99000), got.Amount)
	assert.Equal(t, "INV-2026-05-0001", got.InvoiceNumber)
}

func TestGenerateForSubscription_MissingProfile_Error(t *testing.T) {
	svc := newBillingSvc(&fakeInvoiceStore{}, &fakePPPStore{profiles: map[uint]model.PPPProfile{}}, &fakeHotspotStore{})
	sub := model.Subscription{ID: 3, ServiceType: "pppoe"} // PPPProfileID nil
	_, err := svc.GenerateForSubscription(context.Background(), sub, time.Now(), 7)
	assert.Error(t, err)
}

func TestGenerateForSubscriptionWithAmount_Override(t *testing.T) {
	inv := &fakeInvoiceStore{}
	pid := uint(7)
	ppp := &fakePPPStore{profiles: map[uint]model.PPPProfile{7: {ID: 7, Name: "Paket10M", PriceMonthly: 150000}}}
	svc := newBillingSvc(inv, ppp, &fakeHotspotStore{})
	sub := model.Subscription{ID: 1, CustomerID: 3, ServiceType: "pppoe", PPPProfileID: &pid}
	periodStart := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)

	// Override > 0 dipakai sebagai amount (bukan harga profil).
	override := int64(200000)
	got, err := svc.GenerateForSubscriptionWithAmount(context.Background(), sub, periodStart, 7, &override)
	require.NoError(t, err)
	assert.Equal(t, int64(200000), got.Amount)
	require.Len(t, inv.items, 1)
	assert.Equal(t, int64(200000), inv.items[0][0].Amount)
	assert.Equal(t, int64(200000), inv.items[0][0].UnitPrice)
}

func TestGenerateForSubscriptionWithAmount_NilFallsBackToProfile(t *testing.T) {
	inv := &fakeInvoiceStore{}
	pid := uint(7)
	ppp := &fakePPPStore{profiles: map[uint]model.PPPProfile{7: {ID: 7, Name: "Paket10M", PriceMonthly: 150000}}}
	svc := newBillingSvc(inv, ppp, &fakeHotspotStore{})
	sub := model.Subscription{ID: 1, CustomerID: 3, ServiceType: "pppoe", PPPProfileID: &pid}
	periodStart := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)

	// Override nil → harga dari profil. Override 0 juga harus fallback.
	zero := int64(0)
	for _, override := range []*int64{nil, &zero} {
		got, err := svc.GenerateForSubscriptionWithAmount(context.Background(), sub, periodStart, 7, override)
		require.NoError(t, err)
		assert.Equal(t, int64(150000), got.Amount)
	}
}
