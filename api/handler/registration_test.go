package handler_test

import (
	"context"
	"net/http"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeRegistrationStore — in-memory store.RegistrationStore untuk handler test.
// (fakeSubscriptionStore & fakeCustomerStore di-reuse dari test lain di paket ini.)
type fakeRegistrationStore struct {
	mu   sync.Mutex
	rows map[uint]model.CustomerRegistration
	seq  uint
}

func newFakeRegistrationStore() *fakeRegistrationStore {
	return &fakeRegistrationStore{rows: map[uint]model.CustomerRegistration{}}
}

func (f *fakeRegistrationStore) List(_ context.Context, fil store.RegistrationListFilter) ([]model.CustomerRegistration, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]model.CustomerRegistration, 0, len(f.rows))
	for _, r := range f.rows {
		if fil.Status != "" && r.Status != fil.Status {
			continue
		}
		out = append(out, r)
	}
	return out, nil
}

func (f *fakeRegistrationStore) Get(_ context.Context, id uint) (model.CustomerRegistration, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	r, ok := f.rows[id]
	if !ok {
		return r, store.ErrRegistrationNotFound
	}
	return r, nil
}

func (f *fakeRegistrationStore) Create(_ context.Context, r *model.CustomerRegistration) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if r.Status == "" {
		r.Status = "pending"
	}
	f.seq++
	r.ID = f.seq
	f.rows[r.ID] = *r
	return nil
}

func (f *fakeRegistrationStore) Update(_ context.Context, r *model.CustomerRegistration) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.rows[r.ID]; !ok {
		return store.ErrRegistrationNotFound
	}
	f.rows[r.ID] = *r
	return nil
}

var _ store.RegistrationStore = (*fakeRegistrationStore)(nil)

// ── setup ──────────────────────────────────────────────────────────────────

func setupRegEngine(t *testing.T) (*gin.Engine, *fakeRegistrationStore, *fakeCustomerStore, *fakeSubscriptionStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	regS := newFakeRegistrationStore()
	custS := newFakeCustomerStore()
	subS := newFakeSubStore()
	// Billing/Notification/Settings/Audit nil → handler tetap jalan (nil-safe).
	h := handler.NewRegistrations(regS, custS, subS, nil, nil, nil, nil, nil)
	g := r.Group("/api/v1")
	h.RegisterPublic(g)
	h.RegisterStaff(g)
	return r, regS, custS, subS
}

// ── tests ──────────────────────────────────────────────────────────────────

func TestRegistrations_SubmitPublic_OK(t *testing.T) {
	r, regS, _, _ := setupRegEngine(t)
	w := doJSON(r, http.MethodPost, "/api/v1/public/registrations", map[string]any{
		"full_name": "Pak Budi", "phone": "0811222", "address": "Jl. Mawar 1", "area": "RT01",
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"status":"pending"`)
	list, _ := regS.List(context.Background(), store.RegistrationListFilter{})
	require.Len(t, list, 1)
}

func TestRegistrations_SubmitPublic_PersistsPackageChoice(t *testing.T) {
	r, regS, _, _ := setupRegEngine(t)
	w := doJSON(r, http.MethodPost, "/api/v1/public/registrations", map[string]any{
		"full_name": "Bu Sari", "phone": "0822333", "address": "Jl. Melati 9", "area": "RT02",
		"service_type": "hotspot", "hotspot_profile_id": 7, "device_id": 1,
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"service_type":"hotspot"`)

	got, err := regS.Get(context.Background(), 1)
	require.NoError(t, err)
	assert.Equal(t, "hotspot", got.ServiceType)
	require.NotNil(t, got.HotspotProfileID)
	assert.EqualValues(t, 7, *got.HotspotProfileID)
	assert.Nil(t, got.PPPProfileID)
}

func TestRegistrations_SubmitPublic_InvalidServiceType_400(t *testing.T) {
	r, _, _, _ := setupRegEngine(t)
	w := doJSON(r, http.MethodPost, "/api/v1/public/registrations", map[string]any{
		"full_name": "X Y", "phone": "0811", "address": "Jl. Z", "service_type": "fiber",
	})
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "VALIDATION")
}

func TestRegistrations_SubmitPublic_MissingRequired_400(t *testing.T) {
	r, _, _, _ := setupRegEngine(t)
	w := doJSON(r, http.MethodPost, "/api/v1/public/registrations", map[string]any{"phone": "0811"})
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "VALIDATION")
}

func TestRegistrations_Approve_CreatesCustomer(t *testing.T) {
	r, regS, custS, _ := setupRegEngine(t)
	reg := &model.CustomerRegistration{FullName: "Pak Budi", Phone: "0811222", Address: "Jl. A", Status: "pending"}
	_ = regS.Create(context.Background(), reg)

	w := doJSON(r, http.MethodPost, "/api/v1/registrations/1/approve", map[string]any{})
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"status":"approved"`)

	cust, err := custS.GetByPhone(context.Background(), "0811222")
	require.NoError(t, err, "customer harus dibuat saat approve")
	got, _ := regS.Get(context.Background(), 1)
	require.NotNil(t, got.CustomerID)
	assert.Equal(t, cust.ID, *got.CustomerID)
}

func TestRegistrations_Approve_NotPending_409(t *testing.T) {
	r, regS, _, _ := setupRegEngine(t)
	_ = regS.Create(context.Background(), &model.CustomerRegistration{FullName: "X", Phone: "081", Address: "a", Status: "approved"})
	w := doJSON(r, http.MethodPost, "/api/v1/registrations/1/approve", map[string]any{})
	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestRegistrations_Reject(t *testing.T) {
	r, regS, _, _ := setupRegEngine(t)
	_ = regS.Create(context.Background(), &model.CustomerRegistration{FullName: "X", Phone: "081", Address: "a", Status: "pending"})
	w := doJSON(r, http.MethodPost, "/api/v1/registrations/1/reject", map[string]any{"reason": "area belum tercover"})
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	got, _ := regS.Get(context.Background(), 1)
	assert.Equal(t, "rejected", got.Status)
	assert.Equal(t, "area belum tercover", got.RejectionReason)
}

func TestRegistrations_Reject_MissingReason_400(t *testing.T) {
	r, regS, _, _ := setupRegEngine(t)
	_ = regS.Create(context.Background(), &model.CustomerRegistration{FullName: "X", Phone: "081", Address: "a", Status: "pending"})
	w := doJSON(r, http.MethodPost, "/api/v1/registrations/1/reject", map[string]any{})
	assert.Equal(t, http.StatusBadRequest, w.Code)
}

func TestRegistrations_CompleteInstall_CreatesSubscription(t *testing.T) {
	r, regS, custS, subS := setupRegEngine(t)
	cust := &model.Customer{FullName: "Pak Budi", Phone: "0811222", Status: "aktif"}
	_ = custS.Create(context.Background(), cust)
	cid := cust.ID
	_ = regS.Create(context.Background(), &model.CustomerRegistration{
		FullName: "Pak Budi", Phone: "0811222", Address: "Jl. A", Status: "approved", CustomerID: &cid,
	})

	w := doJSON(r, http.MethodPost, "/api/v1/registrations/1/complete-install", map[string]any{
		"device_id":         1,
		"service_type":      "pppoe",
		"ppp_profile_id":    5,
		"mikrotik_username": "budi-001",
		"mikrotik_password": "rahasia",
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())

	subs, _ := subS.List(context.Background(), store.SubscriptionListFilter{})
	require.Len(t, subs, 1)
	sub := subs[0]
	assert.Equal(t, "active", sub.Status)
	assert.Equal(t, "pending_create", sub.SyncStatus, "provisioning lewat outbox")
	assert.Equal(t, "budi-001", sub.MikrotikUsername)
	assert.Equal(t, cust.ID, sub.CustomerID)

	got, _ := regS.Get(context.Background(), 1)
	require.NotNil(t, got.InstalledAt)
}

func TestRegistrations_CompleteInstall_NotApproved_409(t *testing.T) {
	r, regS, _, _ := setupRegEngine(t)
	_ = regS.Create(context.Background(), &model.CustomerRegistration{FullName: "X", Phone: "081", Address: "a", Status: "pending"})
	w := doJSON(r, http.MethodPost, "/api/v1/registrations/1/complete-install", map[string]any{
		"device_id": 1, "service_type": "pppoe", "ppp_profile_id": 5,
		"mikrotik_username": "u", "mikrotik_password": "p",
	})
	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestRegistrations_CompleteInstall_PPPoEMissingProfile_400(t *testing.T) {
	r, regS, _, _ := setupRegEngine(t)
	cid := uint(1)
	_ = regS.Create(context.Background(), &model.CustomerRegistration{FullName: "X", Phone: "081", Address: "a", Status: "approved", CustomerID: &cid})
	w := doJSON(r, http.MethodPost, "/api/v1/registrations/1/complete-install", map[string]any{
		"device_id": 1, "service_type": "pppoe",
		"mikrotik_username": "u", "mikrotik_password": "p",
	})
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "ppp_profile_id required")
}

func TestRegistrations_Get_NotFound(t *testing.T) {
	r, _, _, _ := setupRegEngine(t)
	w := doJSON(r, http.MethodGet, "/api/v1/registrations/99", nil)
	assert.Equal(t, http.StatusNotFound, w.Code)
}
