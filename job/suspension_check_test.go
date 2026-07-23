package job_test

import (
	"context"
	"testing"
	"time"

	"github.com/quiqxiq/rosmon/job"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── Fake stores ───────────────────────────────────────────────────────────────

// fakeSubStore mengimplementasikan subset SubscriptionStore yang dibutuhkan job.
type fakeSubStore struct {
	subs       map[uint]*model.Subscription
	lastStatus map[uint]string
	lastSync   map[uint]string
}

func newFakeSubStore(subs ...*model.Subscription) *fakeSubStore {
	f := &fakeSubStore{
		subs:       make(map[uint]*model.Subscription),
		lastStatus: make(map[uint]string),
		lastSync:   make(map[uint]string),
	}
	for _, s := range subs {
		cp := *s
		f.subs[s.ID] = &cp
	}
	return f
}

func (f *fakeSubStore) Get(_ context.Context, id uint) (model.Subscription, error) {
	if s, ok := f.subs[id]; ok {
		return *s, nil
	}
	return model.Subscription{}, store.ErrSubscriptionNotFound
}

func (f *fakeSubStore) UpdateStatus(_ context.Context, id uint, status string, _, _ *time.Time) error {
	if s, ok := f.subs[id]; ok {
		f.lastStatus[id] = status
		s.Status = status
		return nil
	}
	return store.ErrSubscriptionNotFound
}

func (f *fakeSubStore) UpdateSyncStatus(_ context.Context, id uint, syncStatus, _ string) error {
	if _, ok := f.subs[id]; ok {
		f.lastSync[id] = syncStatus
		return nil
	}
	return store.ErrSubscriptionNotFound
}

// Stub untuk method lain yang tidak dipakai di test ini.
func (f *fakeSubStore) List(_ context.Context, _ store.SubscriptionListFilter) ([]model.Subscription, error) {
	return nil, nil
}
func (f *fakeSubStore) Create(_ context.Context, _ *model.Subscription) error { return nil }
func (f *fakeSubStore) Update(_ context.Context, _ *model.Subscription) error { return nil }
func (f *fakeSubStore) IncrSyncRetry(_ context.Context, _ uint, _ string) (int, error) { return 0, nil }
func (f *fakeSubStore) ResetSyncRetry(_ context.Context, _ uint) error               { return nil }
func (f *fakeSubStore) ListPendingSync(_ context.Context, _ int) ([]model.Subscription, error) {
	return nil, nil
}
func (f *fakeSubStore) UpdateNextInvoiceDate(_ context.Context, _ uint, _ time.Time) error {
	return nil
}
func (f *fakeSubStore) Delete(_ context.Context, _ uint) error                       { return nil }
func (f *fakeSubStore) BatchDelete(_ context.Context, _ []uint) (int64, error)             { return 0, nil }
func (f *fakeSubStore) ChurnByMonth(_ context.Context, _ int) ([]store.ChurnEntry, error) {
	return nil, nil
}
func (f *fakeSubStore) StatusCounts(_ context.Context) (*store.SubscriptionStatusCounts, error) {
	return nil, nil
}
func (f *fakeSubStore) CountCustomers(_ context.Context) (int, error) { return 0, nil }

// fakeInvStore menyimpan skenario invoice overdue secara sederhana.
type fakeInvStore struct {
	overdueInvs []model.Invoice
	lastStatus  map[uint]string
}

func (f *fakeInvStore) ListOverdue(_ context.Context, _ time.Time) ([]model.Invoice, error) {
	return f.overdueInvs, nil
}

func (f *fakeInvStore) UpdateStatus(_ context.Context, id uint, status string, _ *time.Time) error {
	if f.lastStatus == nil {
		f.lastStatus = make(map[uint]string)
	}
	f.lastStatus[id] = status
	for i := range f.overdueInvs {
		if f.overdueInvs[i].ID == id {
			f.overdueInvs[i].Status = status
		}
	}
	return nil
}

// Stub seluruh interface InvoiceStore yang tidak dipakai.
func (f *fakeInvStore) Create(_ context.Context, _ *model.Invoice, _ []model.InvoiceItem) error {
	return nil
}
func (f *fakeInvStore) GetByID(_ context.Context, _ uint) (*model.Invoice, error) { return nil, nil }
func (f *fakeInvStore) GetByPaymentCode(_ context.Context, _ string) (*model.Invoice, error) {
	return nil, nil
}
func (f *fakeInvStore) List(_ context.Context, _ store.InvoiceListFilter) ([]model.Invoice, error) {
	return nil, nil
}
func (f *fakeInvStore) ListDueForBilling(_ context.Context, _ time.Time) ([]model.Invoice, error) {
	return nil, nil
}
func (f *fakeInvStore) MonthlySummary(_ context.Context, _, _ int) (*store.FinancialSummary, error) {
	return nil, nil
}
func (f *fakeInvStore) AgingBuckets(_ context.Context, _ time.Time) ([]store.AgingBucket, error) {
	return nil, nil
}
func (f *fakeInvStore) CountOverdue(_ context.Context) (int, int64, error)         { return 0, 0, nil }
func (f *fakeInvStore) SumPaidThisMonth(_ context.Context, _, _ int) (int64, error) { return 0, nil }
func (f *fakeInvStore) CountPendingPayments(_ context.Context) (int, error)        { return 0, nil }

// fakeSettingStore menyimpan nilai setting statis.
type fakeSettingStore struct{ vals map[string]string }

func (f *fakeSettingStore) Get(_ context.Context, key string) (string, error) {
	if v, ok := f.vals[key]; ok {
		return v, nil
	}
	return "", nil
}
func (f *fakeSettingStore) Set(_ context.Context, _ string, _ string) error { return nil }
func (f *fakeSettingStore) SetOrCreate(_ context.Context, _ string, _ string) error { return nil }
func (f *fakeSettingStore) List(_ context.Context) ([]model.SystemSetting, error) { return nil, nil }

// fakeCustStore stub sederhana.
type fakeCustStore struct{}

func (f *fakeCustStore) Get(_ context.Context, _ uint) (model.Customer, error) {
	return model.Customer{FullName: "Pak Test", Phone: "08111"}, nil
}
func (f *fakeCustStore) GetByPhone(_ context.Context, _ string) (model.Customer, error) {
	return model.Customer{}, nil
}
func (f *fakeCustStore) List(_ context.Context, _ store.CustomerListFilter) ([]model.Customer, error) {
	return nil, nil
}
func (f *fakeCustStore) Create(_ context.Context, _ *model.Customer) error { return nil }
func (f *fakeCustStore) Update(_ context.Context, _ *model.Customer) error { return nil }
func (f *fakeCustStore) Delete(_ context.Context, _ uint) error            { return nil }
func (f *fakeCustStore) BatchDelete(_ context.Context, _ []uint) (int64, error) { return 0, nil }

// fakeAuditStore menyimpan semua entry yang ditulis agar bisa di-assert.
type fakeAuditStore struct {
	entries []model.AuditLog
}

func (f *fakeAuditStore) Create(_ context.Context, e *model.AuditLog) error {
	f.entries = append(f.entries, *e)
	return nil
}
func (f *fakeAuditStore) List(_ context.Context, _ store.AuditLogFilter) ([]model.AuditLog, error) {
	return f.entries, nil
}

// ── Helper ────────────────────────────────────────────────────────────────────

func makeJob(subStore *fakeSubStore, invStore *fakeInvStore, settingVals map[string]string, auditStore *fakeAuditStore, now time.Time) *job.SuspensionCheckJob {
	settings := &fakeSettingStore{vals: settingVals}
	return job.NewSuspensionCheckJob(
		subStore,
		&fakeCustStore{},
		invStore,
		settings,
		nil,          // notification — nil di unit test
		auditStore,
		func() time.Time { return now },
		nil,
	)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// TestSuspensionCheck_IsolirAfterDays — invoice overdue tepat isolir_after_days hari
// → subscription aktif harus berubah ke isolir.
func TestSuspensionCheck_IsolirAfterDays(t *testing.T) {
	now := time.Date(2026, 6, 10, 9, 0, 0, 0, time.UTC)
	isolirAfter := 3

	sub := &model.Subscription{ID: 1, Status: "active", CustomerID: 1}
	dueDate := now.AddDate(0, 0, -isolirAfter) // tepat 3 hari lalu

	subStore := newFakeSubStore(sub)
	invStore := &fakeInvStore{
		overdueInvs: []model.Invoice{
			{ID: 10, SubscriptionID: 1, CustomerID: 1, Status: "issued", DueDate: dueDate, InvoiceNumber: "INV-001"},
		},
	}
	auditStore := &fakeAuditStore{}
	j := makeJob(subStore, invStore, map[string]string{"billing.isolir_after_days": "3"}, auditStore, now)

	require.NoError(t, j.Run(context.Background()))

	assert.Equal(t, "isolir", subStore.lastStatus[1], "status harus berubah ke isolir")
	assert.Equal(t, "pending_profile_change", subStore.lastSync[1], "sync_status harus pending_profile_change")
}

// TestSuspensionCheck_HardSuspendAfterDays — overdue >= hard_suspend_after_days
// → langsung suspended, tidak melalui isolir.
func TestSuspensionCheck_HardSuspendAfterDays(t *testing.T) {
	now := time.Date(2026, 6, 10, 9, 0, 0, 0, time.UTC)
	hardAfter := 14

	sub := &model.Subscription{ID: 2, Status: "active", CustomerID: 2}
	dueDate := now.AddDate(0, 0, -hardAfter) // tepat 14 hari lalu

	subStore := newFakeSubStore(sub)
	invStore := &fakeInvStore{
		overdueInvs: []model.Invoice{
			{ID: 20, SubscriptionID: 2, CustomerID: 2, Status: "issued", DueDate: dueDate},
		},
	}
	j := makeJob(subStore, invStore, map[string]string{
		"billing.isolir_after_days":       "3",
		"billing.hard_suspend_after_days": "14",
	}, &fakeAuditStore{}, now)

	require.NoError(t, j.Run(context.Background()))

	assert.Equal(t, "suspended", subStore.lastStatus[2], "status harus suspended, bukan isolir")
	assert.Equal(t, "pending_disable", subStore.lastSync[2])
}

// TestSuspensionCheck_SkipsAlreadyIsolir — sub sudah isolir → job tidak mengubah kembali
// (idempotensi: isolir candidate dicek sub.Status == "active").
func TestSuspensionCheck_SkipsAlreadyIsolir(t *testing.T) {
	now := time.Date(2026, 6, 10, 9, 0, 0, 0, time.UTC)

	sub := &model.Subscription{ID: 3, Status: "isolir", CustomerID: 3} // sudah isolir
	dueDate := now.AddDate(0, 0, -3)

	subStore := newFakeSubStore(sub)
	invStore := &fakeInvStore{
		overdueInvs: []model.Invoice{
			{ID: 30, SubscriptionID: 3, CustomerID: 3, Status: "overdue", DueDate: dueDate},
		},
	}
	j := makeJob(subStore, invStore, map[string]string{"billing.isolir_after_days": "3"}, &fakeAuditStore{}, now)

	require.NoError(t, j.Run(context.Background()))

	// UpdateStatus tidak dipanggil karena sub.Status != "active"
	_, changed := subStore.lastStatus[3]
	assert.False(t, changed, "status sudah isolir, tidak harus diubah lagi")
}

// TestSuspensionCheck_HardSuspendFromIsolir — sub isolir + overdue >= hard_suspend
// → harus naik ke suspended.
func TestSuspensionCheck_HardSuspendFromIsolir(t *testing.T) {
	now := time.Date(2026, 6, 10, 9, 0, 0, 0, time.UTC)

	sub := &model.Subscription{ID: 4, Status: "isolir", CustomerID: 4}
	dueDate := now.AddDate(0, 0, -14)

	subStore := newFakeSubStore(sub)
	invStore := &fakeInvStore{
		overdueInvs: []model.Invoice{
			{ID: 40, SubscriptionID: 4, CustomerID: 4, Status: "overdue", DueDate: dueDate},
		},
	}
	j := makeJob(subStore, invStore, map[string]string{
		"billing.hard_suspend_after_days": "14",
	}, &fakeAuditStore{}, now)

	require.NoError(t, j.Run(context.Background()))

	assert.Equal(t, "suspended", subStore.lastStatus[4])
}

// TestSuspensionCheck_IsolirProfileFromSetting — nama profil isolir dibaca dari
// system_setting "billing.isolir_profile_name", bukan hardcoded "isolir".
// Test ini memverifikasi bahwa NowFunc dan setting-based logic benar terpasang —
// profile name digunakan oleh outbox (bukan langsung oleh job), jadi kita
// verifikasi via sync_status pending_profile_change yang menjadi trigger outbox.
func TestSuspensionCheck_IsolirProfileFromSetting(t *testing.T) {
	now := time.Date(2026, 6, 10, 9, 0, 0, 0, time.UTC)

	sub := &model.Subscription{ID: 5, Status: "active", CustomerID: 5}
	dueDate := now.AddDate(0, 0, -3)

	subStore := newFakeSubStore(sub)
	invStore := &fakeInvStore{
		overdueInvs: []model.Invoice{
			{ID: 50, SubscriptionID: 5, CustomerID: 5, Status: "issued", DueDate: dueDate},
		},
	}
	// Setting khusus nama profil isolir
	j := makeJob(subStore, invStore, map[string]string{
		"billing.isolir_after_days":    "3",
		"billing.isolir_profile_name":  "throttle-1mbps", // nama custom
	}, &fakeAuditStore{}, now)

	require.NoError(t, j.Run(context.Background()))

	// Job berhasil set isolir — profile name custom digunakan oleh outbox,
	// yang trigger-nya adalah sync_status pending_profile_change.
	assert.Equal(t, "pending_profile_change", subStore.lastSync[5])
}

// TestSuspensionCheck_AuditLogWritten — setelah isolir berhasil, audit_log ditulis.
func TestSuspensionCheck_AuditLogWritten(t *testing.T) {
	now := time.Date(2026, 6, 10, 9, 0, 0, 0, time.UTC)

	sub := &model.Subscription{ID: 6, Status: "active", CustomerID: 6}
	dueDate := now.AddDate(0, 0, -3)

	subStore := newFakeSubStore(sub)
	invStore := &fakeInvStore{
		overdueInvs: []model.Invoice{
			{ID: 60, SubscriptionID: 6, CustomerID: 6, Status: "issued", DueDate: dueDate},
		},
	}
	auditStore := &fakeAuditStore{}
	j := makeJob(subStore, invStore, map[string]string{"billing.isolir_after_days": "3"}, auditStore, now)

	require.NoError(t, j.Run(context.Background()))

	require.Len(t, auditStore.entries, 1, "harus ada 1 audit log entry")
	entry := auditStore.entries[0]
	assert.Equal(t, "subscription_status_changed", entry.Action)
	assert.Equal(t, "subscription", entry.EntityType)
	assert.Nil(t, entry.UserID, "aksi sistem — userID harus nil")
	assert.Contains(t, entry.NewValues, "isolir")
}

// TestSuspensionCheck_AuditLogWrittenForSuspend — suspended juga menghasilkan audit log.
func TestSuspensionCheck_AuditLogWrittenForSuspend(t *testing.T) {
	now := time.Date(2026, 6, 10, 9, 0, 0, 0, time.UTC)

	sub := &model.Subscription{ID: 7, Status: "active", CustomerID: 7}
	dueDate := now.AddDate(0, 0, -14)

	subStore := newFakeSubStore(sub)
	invStore := &fakeInvStore{
		overdueInvs: []model.Invoice{
			{ID: 70, SubscriptionID: 7, CustomerID: 7, Status: "issued", DueDate: dueDate},
		},
	}
	auditStore := &fakeAuditStore{}
	j := makeJob(subStore, invStore, map[string]string{
		"billing.hard_suspend_after_days": "14",
	}, auditStore, now)

	require.NoError(t, j.Run(context.Background()))

	require.Len(t, auditStore.entries, 1)
	assert.Equal(t, "subscription_status_changed", auditStore.entries[0].Action)
	assert.Contains(t, auditStore.entries[0].NewValues, "suspended")
}

// TestSuspensionCheck_IdempotentDoubleRun — job dijalankan 2x: run pertama
// mengubah sub ke isolir, run kedua tidak mengubah lagi (sub.Status != "active").
func TestSuspensionCheck_IdempotentDoubleRun(t *testing.T) {
	now := time.Date(2026, 6, 10, 9, 0, 0, 0, time.UTC)

	sub := &model.Subscription{ID: 8, Status: "active", CustomerID: 8}
	dueDate := now.AddDate(0, 0, -3)

	subStore := newFakeSubStore(sub)
	invStore := &fakeInvStore{
		overdueInvs: []model.Invoice{
			{ID: 80, SubscriptionID: 8, CustomerID: 8, Status: "issued", DueDate: dueDate},
		},
	}
	auditStore := &fakeAuditStore{}
	j := makeJob(subStore, invStore, map[string]string{"billing.isolir_after_days": "3"}, auditStore, now)

	// Run pertama
	require.NoError(t, j.Run(context.Background()))
	assert.Equal(t, "isolir", subStore.lastStatus[8])
	assert.Len(t, auditStore.entries, 1)

	// Run kedua — sub sudah isolir, tidak ada perubahan tambahan
	require.NoError(t, j.Run(context.Background()))
	assert.Equal(t, "isolir", subStore.subs[8].Status, "status tidak berubah di run ke-2")
	assert.Len(t, auditStore.entries, 1, "audit log tidak dobel di run ke-2")
}
