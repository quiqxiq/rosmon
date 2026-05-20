package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/roslib-mikhmon/api/dto"
	"github.com/quiqxiq/roslib-mikhmon/api/handler"
	"github.com/quiqxiq/roslib-mikhmon/store"
	"github.com/quiqxiq/roslib-mikhmon/store/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeProfileConfigStore — in-memory implementasi untuk handler test.
type fakeProfileConfigStore struct {
	mu     sync.Mutex
	byKey  map[string]*model.HotspotProfileConfig
	nextID uint
}

func newFakeProfileConfigStore() *fakeProfileConfigStore {
	return &fakeProfileConfigStore{
		byKey:  make(map[string]*model.HotspotProfileConfig),
		nextID: 1,
	}
}

func keyOf(deviceID uint, name string) string {
	return string(rune(deviceID)) + ":" + name
}

func (f *fakeProfileConfigStore) Get(ctx context.Context, deviceID uint, profileName string) (model.HotspotProfileConfig, error) {
	cfg, err := f.GetByName(ctx, deviceID, profileName)
	if errors.Is(err, store.ErrProfileConfigNotFound) {
		// Match existing fallback: return default {ExpiryMode: "rem"}.
		return model.HotspotProfileConfig{
			DeviceID: deviceID, ProfileName: profileName, ExpiryMode: "rem",
		}, nil
	}
	return cfg, err
}

func (f *fakeProfileConfigStore) GetByName(ctx context.Context, deviceID uint, profileName string) (model.HotspotProfileConfig, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if cfg, ok := f.byKey[keyOf(deviceID, profileName)]; ok {
		return *cfg, nil
	}
	return model.HotspotProfileConfig{}, store.ErrProfileConfigNotFound
}

func (f *fakeProfileConfigStore) Upsert(ctx context.Context, cfg *model.HotspotProfileConfig) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	k := keyOf(cfg.DeviceID, cfg.ProfileName)
	if existing, ok := f.byKey[k]; ok {
		cfg.ID = existing.ID
		cfg.CreatedAt = existing.CreatedAt
	} else {
		cfg.ID = f.nextID
		f.nextID++
		cfg.CreatedAt = time.Now()
	}
	cfg.UpdatedAt = time.Now()
	cp := *cfg
	f.byKey[k] = &cp
	return nil
}

func (f *fakeProfileConfigStore) UpsertResult(ctx context.Context, cfg *model.HotspotProfileConfig) (bool, error) {
	f.mu.Lock()
	k := keyOf(cfg.DeviceID, cfg.ProfileName)
	_, exists := f.byKey[k]
	f.mu.Unlock()
	if err := f.Upsert(ctx, cfg); err != nil {
		return false, err
	}
	return !exists, nil
}

func (f *fakeProfileConfigStore) ListByDevice(ctx context.Context, deviceID uint) ([]model.HotspotProfileConfig, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]model.HotspotProfileConfig, 0)
	for _, cfg := range f.byKey {
		if cfg.DeviceID == deviceID {
			out = append(out, *cfg)
		}
	}
	return out, nil
}

func (f *fakeProfileConfigStore) Delete(ctx context.Context, id uint) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for k, cfg := range f.byKey {
		if cfg.ID == id {
			delete(f.byKey, k)
			return nil
		}
	}
	return store.ErrProfileConfigNotFound
}

func (f *fakeProfileConfigStore) DeleteByName(ctx context.Context, deviceID uint, profileName string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	k := keyOf(deviceID, profileName)
	if _, ok := f.byKey[k]; !ok {
		return store.ErrProfileConfigNotFound
	}
	delete(f.byKey, k)
	return nil
}

// setupProfileConfigEngine bangun Gin engine untuk handler test.
func setupProfileConfigEngine(t *testing.T) (*gin.Engine, *fakeProfileConfigStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	fake := newFakeProfileConfigStore()
	g := r.Group("/api/v1")
	devGroup := g.Group("/devices/:device_id")
	handler.NewProfileConfig(fake).Register(devGroup)
	return r, fake
}

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
	_, err := fake.UpsertResult(context.Background(), &model.HotspotProfileConfig{
		DeviceID: 5, ProfileName: "premium",
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
		_, err := fake.UpsertResult(context.Background(), &model.HotspotProfileConfig{
			DeviceID: 3, ProfileName: name, ExpiryMode: "rem", Validity: "7d",
		})
		require.NoError(t, err)
	}
	// Device lain → tidak ter-list
	_, err := fake.UpsertResult(context.Background(), &model.HotspotProfileConfig{
		DeviceID: 99, ProfileName: "other", ExpiryMode: "rem", Validity: "7d",
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
	_, err := fake.UpsertResult(context.Background(), &model.HotspotProfileConfig{
		DeviceID: 1, ProfileName: "default", ExpiryMode: "rem", Validity: "7d",
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
