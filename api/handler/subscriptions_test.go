package handler_test

import (
	"context"
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

// fakeSubscriptionStore — in-memory implementasi store.SubscriptionStore
// untuk handler test.
type fakeSubscriptionStore struct {
	mu   sync.Mutex
	rows map[uint]model.Subscription
	seq  uint
}

func newFakeSubStore() *fakeSubscriptionStore {
	return &fakeSubscriptionStore{rows: map[uint]model.Subscription{}}
}

func (f *fakeSubscriptionStore) List(ctx context.Context, fil store.SubscriptionListFilter) ([]model.Subscription, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]model.Subscription, 0)
	for _, s := range f.rows {
		if fil.CustomerID != 0 && s.CustomerID != fil.CustomerID {
			continue
		}
		if fil.DeviceID != 0 && s.DeviceID != fil.DeviceID {
			continue
		}
		if fil.Status != "" && s.Status != fil.Status {
			continue
		}
		if fil.ServiceType != "" && s.ServiceType != fil.ServiceType {
			continue
		}
		out = append(out, s)
	}
	return out, nil
}

func (f *fakeSubscriptionStore) Get(ctx context.Context, id uint) (model.Subscription, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	s, ok := f.rows[id]
	if !ok {
		return s, store.ErrSubscriptionNotFound
	}
	return s, nil
}

func (f *fakeSubscriptionStore) Create(ctx context.Context, s *model.Subscription) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, existing := range f.rows {
		if existing.DeviceID == s.DeviceID &&
			existing.ServiceType == s.ServiceType &&
			existing.MikrotikUsername == s.MikrotikUsername {
			return store.ErrSubscriptionUsernameTaken
		}
	}
	if s.Status == "" {
		s.Status = "pending_install"
	}
	f.seq++
	s.ID = f.seq
	s.CreatedAt = time.Now()
	s.UpdatedAt = s.CreatedAt
	f.rows[s.ID] = *s
	return nil
}

func (f *fakeSubscriptionStore) Update(ctx context.Context, s *model.Subscription) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.rows[s.ID]; !ok {
		return store.ErrSubscriptionNotFound
	}
	s.UpdatedAt = time.Now()
	f.rows[s.ID] = *s
	return nil
}

func (f *fakeSubscriptionStore) UpdateStatus(ctx context.Context, id uint, status string, activatedAt, terminatedAt *time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	s, ok := f.rows[id]
	if !ok {
		return store.ErrSubscriptionNotFound
	}
	s.Status = status
	if activatedAt != nil {
		s.ActivatedAt = activatedAt
	}
	if terminatedAt != nil {
		s.TerminatedAt = terminatedAt
	}
	s.UpdatedAt = time.Now()
	f.rows[id] = s
	return nil
}

func (f *fakeSubscriptionStore) Delete(ctx context.Context, id uint) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.rows[id]; !ok {
		return store.ErrSubscriptionNotFound
	}
	delete(f.rows, id)
	return nil
}

func (f *fakeSubscriptionStore) UpdateSyncStatus(_ context.Context, id uint, syncStatus, syncNotes string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	sub, ok := f.rows[id]
	if !ok {
		return store.ErrSubscriptionNotFound
	}
	sub.SyncStatus = syncStatus
	sub.SyncNotes = syncNotes
	f.rows[id] = sub
	return nil
}

func (f *fakeSubscriptionStore) ListPendingSync(_ context.Context, limit int) ([]model.Subscription, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []model.Subscription
	for _, s := range f.rows {
		if s.SyncStatus != "synced" && s.SyncStatus != "" {
			out = append(out, s)
		}
		if len(out) >= limit {
			break
		}
	}
	return out, nil
}

func (f *fakeSubscriptionStore) UpdateNextInvoiceDate(_ context.Context, id uint, next time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	s, ok := f.rows[id]
	if !ok {
		return store.ErrSubscriptionNotFound
	}
	s.NextInvoiceDate = &next
	s.UpdatedAt = time.Now()
	f.rows[id] = s
	return nil
}

var _ store.SubscriptionStore = (*fakeSubscriptionStore)(nil)

// fakePPPProfileStore — in-memory implementasi store.PPPProfileStore.
type fakePPPProfileStore struct {
	mu   sync.Mutex
	rows map[uint]model.PPPProfile
	seq  uint
}

func newFakePPPStore() *fakePPPProfileStore {
	return &fakePPPProfileStore{rows: map[uint]model.PPPProfile{}}
}

func (f *fakePPPProfileStore) ListPublic(ctx context.Context) ([]model.PPPProfile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []model.PPPProfile
	for _, p := range f.rows {
		if p.IsPublic && p.Active {
			out = append(out, p)
		}
	}
	return out, nil
}

func (f *fakePPPProfileStore) ListByDevice(ctx context.Context, deviceID uint) ([]model.PPPProfile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []model.PPPProfile
	for _, p := range f.rows {
		if p.DeviceID == deviceID {
			out = append(out, p)
		}
	}
	return out, nil
}

func (f *fakePPPProfileStore) Get(ctx context.Context, id uint) (model.PPPProfile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	p, ok := f.rows[id]
	if !ok {
		return p, store.ErrPPPProfileNotFound
	}
	return p, nil
}

func (f *fakePPPProfileStore) GetByName(ctx context.Context, deviceID uint, name string) (model.PPPProfile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, p := range f.rows {
		if p.DeviceID == deviceID && p.Name == name {
			return p, nil
		}
	}
	return model.PPPProfile{}, store.ErrPPPProfileNotFound
}

func (f *fakePPPProfileStore) Create(ctx context.Context, p *model.PPPProfile) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.seq++
	p.ID = f.seq
	p.CreatedAt = time.Now()
	p.UpdatedAt = p.CreatedAt
	f.rows[p.ID] = *p
	return nil
}

func (f *fakePPPProfileStore) Update(ctx context.Context, p *model.PPPProfile) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.rows[p.ID]; !ok {
		return store.ErrPPPProfileNotFound
	}
	p.UpdatedAt = time.Now()
	f.rows[p.ID] = *p
	return nil
}

func (f *fakePPPProfileStore) Delete(ctx context.Context, id uint) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.rows[id]; !ok {
		return store.ErrPPPProfileNotFound
	}
	delete(f.rows, id)
	return nil
}

func (f *fakePPPProfileStore) Upsert(ctx context.Context, p *model.PPPProfile) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for id, existing := range f.rows {
		if existing.DeviceID == p.DeviceID && existing.Name == p.Name {
			p.ID = id
			p.CreatedAt = existing.CreatedAt
			p.UpdatedAt = time.Now()
			f.rows[id] = *p
			return false, nil
		}
	}
	f.seq++
	p.ID = f.seq
	p.CreatedAt = time.Now()
	p.UpdatedAt = p.CreatedAt
	f.rows[p.ID] = *p
	return true, nil
}

var _ store.PPPProfileStore = (*fakePPPProfileStore)(nil)

func setupSubEngine(t *testing.T) (*gin.Engine, *fakeSubscriptionStore, *fakeCustomerStore, *fakePPPProfileStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	subS := newFakeSubStore()
	custS := newFakeCustomerStore()
	pppS := newFakePPPStore()
	g := r.Group("/api/v1")
	handler.NewSubscriptions(subS, custS, pppS, nil, nil, nil, nil).Register(g)
	return r, subS, custS, pppS
}

// seedCustomerAndProfile membuat 1 customer + 1 ppp_profile di device 1.
// Return: customerID, pppProfileID.
func seedCustomerAndProfile(t *testing.T, custS *fakeCustomerStore, pppS *fakePPPProfileStore) (uint, uint) {
	t.Helper()
	cust := &model.Customer{FullName: "Pak Budi", Phone: "08111", Status: "aktif"}
	require.NoError(t, custS.Create(context.Background(), cust))
	pp := &model.PPPProfile{
		DeviceID: 1, Name: "ppp-10M",
		RateLimit: "10M/10M", PriceMonthly: 150000, Active: true,
	}
	require.NoError(t, pppS.Create(context.Background(), pp))
	return cust.ID, pp.ID
}

func TestSubscriptions_Create_OfflineDevice_OK(t *testing.T) {
	r, subS, custS, pppS := setupSubEngine(t)
	custID, ppID := seedCustomerAndProfile(t, custS, pppS)

	w := doJSON(r, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"customer_id":       custID,
		"device_id":         1,
		"ppp_profile_id":    ppID,
		"service_type":      "pppoe",
		"mikrotik_username": "budi-001",
		"mikrotik_password": "rahasia",
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"mikrotik_username":"budi-001"`)
	assert.Contains(t, w.Body.String(), "device offline")
	// Status tetap pending_install karena MikroTik provision gagal.
	assert.Contains(t, w.Body.String(), `"status":"pending_install"`)

	subs, _ := subS.List(context.Background(), store.SubscriptionListFilter{})
	require.Len(t, subs, 1)
}

func TestSubscriptions_Create_CustomerNotFound_400(t *testing.T) {
	r, _, _, pppS := setupSubEngine(t)
	pp := &model.PPPProfile{DeviceID: 1, Name: "x", Active: true}
	require.NoError(t, pppS.Create(context.Background(), pp))

	w := doJSON(r, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"customer_id":       99, // not exist
		"device_id":         1,
		"ppp_profile_id":    pp.ID,
		"service_type":      "pppoe",
		"mikrotik_username": "x",
		"mikrotik_password": "x",
	})
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "customer not found")
}

func TestSubscriptions_Create_ProfileRequired_400(t *testing.T) {
	r, _, custS, _ := setupSubEngine(t)
	cust := &model.Customer{FullName: "A", Phone: "081", Status: "aktif"}
	require.NoError(t, custS.Create(context.Background(), cust))

	// pppoe without ppp_profile_id → error
	w := doJSON(r, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"customer_id":       cust.ID,
		"device_id":         1,
		"service_type":      "pppoe",
		"mikrotik_username": "x",
		"mikrotik_password": "x",
	})
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "ppp_profile_id required")
}

func TestSubscriptions_Create_DeviceMismatch_400(t *testing.T) {
	r, _, custS, pppS := setupSubEngine(t)
	custID, ppID := seedCustomerAndProfile(t, custS, pppS) // profile on device 1

	w := doJSON(r, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"customer_id":       custID,
		"device_id":         2, // different device
		"ppp_profile_id":    ppID,
		"service_type":      "pppoe",
		"mikrotik_username": "x",
		"mikrotik_password": "x",
	})
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "different device")
}

func TestSubscriptions_Create_DuplicateUsername_409(t *testing.T) {
	r, _, custS, pppS := setupSubEngine(t)
	custID, ppID := seedCustomerAndProfile(t, custS, pppS)

	body := map[string]any{
		"customer_id":       custID,
		"device_id":         1,
		"ppp_profile_id":    ppID,
		"service_type":      "pppoe",
		"mikrotik_username": "budi-001",
		"mikrotik_password": "x",
	}
	doJSON(r, http.MethodPost, "/api/v1/subscriptions", body)
	w := doJSON(r, http.MethodPost, "/api/v1/subscriptions", body)
	assert.Equal(t, http.StatusConflict, w.Code)
	assert.Contains(t, w.Body.String(), "CONFLICT")
}

func TestSubscriptions_PatchStatus_Active_SetsActivatedAt(t *testing.T) {
	r, subS, custS, pppS := setupSubEngine(t)
	custID, ppID := seedCustomerAndProfile(t, custS, pppS)
	doJSON(r, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"customer_id": custID, "device_id": 1, "ppp_profile_id": ppID,
		"service_type": "pppoe", "mikrotik_username": "x", "mikrotik_password": "x",
	})

	w := doJSON(r, http.MethodPatch, "/api/v1/subscriptions/1/status", map[string]any{
		"status": "active",
	})
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	s, _ := subS.Get(context.Background(), 1)
	assert.Equal(t, "active", s.Status)
	require.NotNil(t, s.ActivatedAt, "active status harus set activated_at")
}

func TestSubscriptions_PatchStatus_Terminated_SetsTerminatedAt(t *testing.T) {
	r, subS, custS, pppS := setupSubEngine(t)
	custID, ppID := seedCustomerAndProfile(t, custS, pppS)
	doJSON(r, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"customer_id": custID, "device_id": 1, "ppp_profile_id": ppID,
		"service_type": "pppoe", "mikrotik_username": "x", "mikrotik_password": "x",
	})

	w := doJSON(r, http.MethodPatch, "/api/v1/subscriptions/1/status", map[string]any{
		"status": "terminated",
	})
	require.Equal(t, http.StatusOK, w.Code)
	s, _ := subS.Get(context.Background(), 1)
	assert.Equal(t, "terminated", s.Status)
	require.NotNil(t, s.TerminatedAt)
}

func TestSubscriptions_PatchStatus_InvalidValue_400(t *testing.T) {
	r, _, custS, pppS := setupSubEngine(t)
	custID, ppID := seedCustomerAndProfile(t, custS, pppS)
	doJSON(r, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"customer_id": custID, "device_id": 1, "ppp_profile_id": ppID,
		"service_type": "pppoe", "mikrotik_username": "x", "mikrotik_password": "x",
	})

	w := doJSON(r, http.MethodPatch, "/api/v1/subscriptions/1/status", map[string]any{
		"status": "frozen", // invalid
	})
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "VALIDATION")
}

func TestSubscriptions_Update_PartialFields(t *testing.T) {
	r, subS, custS, pppS := setupSubEngine(t)
	custID, ppID := seedCustomerAndProfile(t, custS, pppS)
	doJSON(r, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"customer_id": custID, "device_id": 1, "ppp_profile_id": ppID,
		"service_type": "pppoe", "mikrotik_username": "u1", "mikrotik_password": "p1",
		"notes": "first",
	})

	w := doJSON(r, http.MethodPut, "/api/v1/subscriptions/1", map[string]any{
		"notes": "updated note",
	})
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	s, _ := subS.Get(context.Background(), 1)
	assert.Equal(t, "updated note", s.Notes)
	assert.Equal(t, "u1", s.MikrotikUsername, "username tidak boleh ke-overwrite")
}

func TestSubscriptions_Delete(t *testing.T) {
	r, subS, custS, pppS := setupSubEngine(t)
	custID, ppID := seedCustomerAndProfile(t, custS, pppS)
	doJSON(r, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"customer_id": custID, "device_id": 1, "ppp_profile_id": ppID,
		"service_type": "pppoe", "mikrotik_username": "u1", "mikrotik_password": "p1",
	})

	w := doJSON(r, http.MethodDelete, "/api/v1/subscriptions/1", nil)
	// DevMgr nil → warning body, status 200.
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "device offline")

	_, err := subS.Get(context.Background(), 1)
	assert.ErrorIs(t, err, store.ErrSubscriptionNotFound)
}

func TestSubscriptions_Reconcile_DeviceOffline_503(t *testing.T) {
	r, _, custS, pppS := setupSubEngine(t)
	custID, ppID := seedCustomerAndProfile(t, custS, pppS)
	doJSON(r, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"customer_id": custID, "device_id": 1, "ppp_profile_id": ppID,
		"service_type": "pppoe", "mikrotik_username": "u1", "mikrotik_password": "p1",
	})

	w := doJSON(r, http.MethodPost, "/api/v1/subscriptions/1/reconcile", nil)
	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
}

func TestSubscriptions_List_FilterByCustomer(t *testing.T) {
	r, _, custS, pppS := setupSubEngine(t)
	custID, ppID := seedCustomerAndProfile(t, custS, pppS)
	cust2 := &model.Customer{FullName: "Bu Ani", Phone: "08222", Status: "aktif"}
	require.NoError(t, custS.Create(context.Background(), cust2))

	doJSON(r, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"customer_id": custID, "device_id": 1, "ppp_profile_id": ppID,
		"service_type": "pppoe", "mikrotik_username": "u1", "mikrotik_password": "p",
	})
	doJSON(r, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"customer_id": cust2.ID, "device_id": 1, "ppp_profile_id": ppID,
		"service_type": "pppoe", "mikrotik_username": "u2", "mikrotik_password": "p",
	})

	w := doJSON(r, http.MethodGet, "/api/v1/subscriptions?customer_id=1", nil)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"mikrotik_username":"u1"`)
	assert.NotContains(t, w.Body.String(), `"mikrotik_username":"u2"`)
}
