package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeProfileConfigStore — in-memory HotspotProfileStore stub untuk handler test.
type fakeProfileConfigStore struct {
	mu     sync.Mutex
	byKey  map[string]*model.HotspotProfile
	byID   map[uint]*model.HotspotProfile
	nextID uint
}

func newFakeProfileConfigStore() *fakeProfileConfigStore {
	return &fakeProfileConfigStore{
		byKey:  make(map[string]*model.HotspotProfile),
		byID:   make(map[uint]*model.HotspotProfile),
		nextID: 1,
	}
}

func keyOf(deviceID uint, name string) string {
	return string(rune(deviceID)) + ":" + name
}

func (f *fakeProfileConfigStore) ListByDevice(ctx context.Context, deviceID uint, filter store.HotspotProfileListFilter) ([]model.HotspotProfile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]model.HotspotProfile, 0)
	for _, p := range f.byKey {
		if p.DeviceID != deviceID {
			continue
		}
		if filter.Role != "" && p.Role != filter.Role {
			continue
		}
		if filter.OnlyActive && !p.Active {
			continue
		}
		out = append(out, *p)
	}
	return out, nil
}

func (f *fakeProfileConfigStore) Get(ctx context.Context, id uint) (model.HotspotProfile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if p, ok := f.byID[id]; ok {
		return *p, nil
	}
	return model.HotspotProfile{}, store.ErrHotspotProfileNotFound
}

func (f *fakeProfileConfigStore) GetByName(ctx context.Context, deviceID uint, name string) (model.HotspotProfile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if p, ok := f.byKey[keyOf(deviceID, name)]; ok {
		return *p, nil
	}
	return model.HotspotProfile{}, store.ErrHotspotProfileNotFound
}

func (f *fakeProfileConfigStore) Create(ctx context.Context, p *model.HotspotProfile) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	p.ID = f.nextID
	f.nextID++
	p.CreatedAt = time.Now()
	p.UpdatedAt = time.Now()
	cp := *p
	f.byKey[keyOf(p.DeviceID, p.Name)] = &cp
	f.byID[cp.ID] = &cp
	return nil
}

func (f *fakeProfileConfigStore) Update(ctx context.Context, p *model.HotspotProfile) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	k := keyOf(p.DeviceID, p.Name)
	if _, ok := f.byKey[k]; !ok {
		return store.ErrHotspotProfileNotFound
	}
	p.UpdatedAt = time.Now()
	cp := *p
	f.byKey[k] = &cp
	f.byID[cp.ID] = &cp
	return nil
}

func (f *fakeProfileConfigStore) Delete(ctx context.Context, id uint) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	p, ok := f.byID[id]
	if !ok {
		return store.ErrHotspotProfileNotFound
	}
	delete(f.byKey, keyOf(p.DeviceID, p.Name))
	delete(f.byID, id)
	return nil
}

func (f *fakeProfileConfigStore) Upsert(ctx context.Context, p *model.HotspotProfile) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	k := keyOf(p.DeviceID, p.Name)
	if existing, ok := f.byKey[k]; ok {
		p.ID = existing.ID
		p.CreatedAt = existing.CreatedAt
		// Preserve operator fields like the real store.
		p.Role = existing.Role
		p.PriceMonthly = existing.PriceMonthly
		p.ExpiryMode = existing.ExpiryMode
		p.Validity = existing.Validity
		p.Price = existing.Price
		p.SellPrice = existing.SellPrice
		p.LockMAC = existing.LockMAC
		p.Description = existing.Description
		p.UpdatedAt = time.Now()
		cp := *p
		f.byKey[k] = &cp
		f.byID[cp.ID] = &cp
		return false, nil
	}
	p.ID = f.nextID
	f.nextID++
	p.CreatedAt = time.Now()
	p.UpdatedAt = time.Now()
	cp := *p
	f.byKey[k] = &cp
	f.byID[cp.ID] = &cp
	return true, nil
}

// setupProfileConfigEngine bangun Gin engine untuk handler test.
func setupProfileConfigEngine(t *testing.T) (*gin.Engine, *fakeProfileConfigStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	fake := newFakeProfileConfigStore()
	g := r.Group("/api/v1")
	devGroup := g.Group("/devices/:device_id")
	// devMgr=nil + goServiceURL="" → handler tetap berfungsi untuk
	// CRUD murni di DB (auto-inject di-skip karena devMgr nil).
	handler.NewProfileConfig(fake, nil, "", nil).Register(devGroup)
	return r, fake
}

// Compile-time interface check.
var _ store.HotspotProfileStore = (*fakeProfileConfigStore)(nil)

func TestProfileConfig_upsert_creates(t *testing.T) {
	r, fake := setupProfileConfigEngine(t)

	body, _ := json.Marshal(dto.ProfileConfigUpsertRequest{
		ExpiryMode: "rem",
		Validity:   "7d", // RouterOS format input
		Price:      10000,
		SellPrice:  12000,
		LockMAC:    false,
	})
	req := httptest.NewRequest(http.MethodPut,
		"/api/v1/devices/1/hotspot/profile-configs/default", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())

	var resp struct {
		Data dto.ProfileConfigResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	// Validity harus ter-normalize ke RouterOS canonical: "7d" → "1w".
	assert.Equal(t, "1w", resp.Data.Validity)
	assert.Equal(t, "rem", resp.Data.ExpiryMode)
	assert.Equal(t, 12000, resp.Data.SellPrice)

	// Verify fake store sebenarnya menyimpan canonical form.
	stored, err := fake.GetByName(context.Background(), 1, "default")
	require.NoError(t, err)
	assert.Equal(t, "1w", stored.Validity)
}

func TestProfileConfig_upsert_updates(t *testing.T) {
	r, _ := setupProfileConfigEngine(t)

	// First upsert: create
	body1, _ := json.Marshal(dto.ProfileConfigUpsertRequest{
		ExpiryMode: "rem", Validity: "7d", Price: 10000, SellPrice: 12000,
	})
	req := httptest.NewRequest(http.MethodPut,
		"/api/v1/devices/1/hotspot/profile-configs/vip", bytes.NewReader(body1))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code)

	// Second upsert: update (sama key)
	body2, _ := json.Marshal(dto.ProfileConfigUpsertRequest{
		ExpiryMode: "ntf", Validity: "168h", Price: 15000, SellPrice: 20000,
	})
	req = httptest.NewRequest(http.MethodPut,
		"/api/v1/devices/1/hotspot/profile-configs/vip", bytes.NewReader(body2))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var resp struct {
		Data dto.ProfileConfigResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "ntf", resp.Data.ExpiryMode)
	assert.Equal(t, "1w", resp.Data.Validity) // 168h → 1w
	assert.Equal(t, 20000, resp.Data.SellPrice)
}

func TestProfileConfig_upsert_invalidValidity(t *testing.T) {
	r, _ := setupProfileConfigEngine(t)
	body, _ := json.Marshal(dto.ProfileConfigUpsertRequest{
		ExpiryMode: "rem",
		Validity:   "1week", // invalid
		Price:      100, SellPrice: 200,
	})
	req := httptest.NewRequest(http.MethodPut,
		"/api/v1/devices/1/hotspot/profile-configs/default", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusBadRequest, w.Code)
}

func TestProfileConfig_upsert_invalidExpiryMode(t *testing.T) {
	r, _ := setupProfileConfigEngine(t)
	body, _ := json.Marshal(dto.ProfileConfigUpsertRequest{
		ExpiryMode: "unknown",
		Validity:   "7d",
	})
	req := httptest.NewRequest(http.MethodPut,
		"/api/v1/devices/1/hotspot/profile-configs/default", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusBadRequest, w.Code)
}

func TestProfileConfig_get_notFound(t *testing.T) {
	r, _ := setupProfileConfigEngine(t)
	req := httptest.NewRequest(http.MethodGet,
		"/api/v1/devices/1/hotspot/profile-configs/missing", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusNotFound, w.Code)
}

func TestProfileConfig_get_existing(t *testing.T) {
	r, fake := setupProfileConfigEngine(t)
	// Seed
	_, err := fake.Upsert(context.Background(), &model.HotspotProfile{
		DeviceID: 5, Name: "premium", Role: "voucher",
		ExpiryMode: "remc", Validity: "30d", Price: 50000, SellPrice: 75000,
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet,
		"/api/v1/devices/5/hotspot/profile-configs/premium", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Data dto.ProfileConfigResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Equal(t, "premium", resp.Data.ProfileName)
	assert.Equal(t, "remc", resp.Data.ExpiryMode)
	assert.Equal(t, 75000, resp.Data.SellPrice)
}

func TestProfileConfig_list(t *testing.T) {
	r, fake := setupProfileConfigEngine(t)
	for _, name := range []string{"default", "vip", "premium"} {
		_, err := fake.Upsert(context.Background(), &model.HotspotProfile{
			DeviceID: 3, Name: name, Role: "voucher", ExpiryMode: "rem", Validity: "7d",
		})
		require.NoError(t, err)
	}
	// Device lain → tidak ter-list
	_, err := fake.Upsert(context.Background(), &model.HotspotProfile{
		DeviceID: 99, Name: "other", Role: "voucher", ExpiryMode: "rem", Validity: "7d",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet,
		"/api/v1/devices/3/hotspot/profile-configs", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)

	var resp struct {
		Data []dto.ProfileConfigResponse `json:"data"`
		Meta map[string]any              `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.Len(t, resp.Data, 3)
	assert.Equal(t, float64(3), resp.Meta["count"])
}

func TestProfileConfig_delete(t *testing.T) {
	r, fake := setupProfileConfigEngine(t)
	_, err := fake.Upsert(context.Background(), &model.HotspotProfile{
		DeviceID: 1, Name: "default", Role: "voucher", ExpiryMode: "rem", Validity: "7d",
	})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodDelete,
		"/api/v1/devices/1/hotspot/profile-configs/default", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusNoContent, w.Code)

	// Subsequent get → 404
	req = httptest.NewRequest(http.MethodGet,
		"/api/v1/devices/1/hotspot/profile-configs/default", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusNotFound, w.Code)
}

func TestProfileConfig_delete_notFound(t *testing.T) {
	r, _ := setupProfileConfigEngine(t)
	req := httptest.NewRequest(http.MethodDelete,
		"/api/v1/devices/1/hotspot/profile-configs/ghost", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusNotFound, w.Code)
}
