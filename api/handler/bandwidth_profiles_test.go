package handler_test

import (
	"context"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/roslib-mikhmon/api/handler"
	"github.com/quiqxiq/roslib-mikhmon/store"
	"github.com/quiqxiq/roslib-mikhmon/store/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeBandwidthProfileStore — in-memory implementasi store.BandwidthProfileStore.
type fakeBandwidthProfileStore struct {
	mu   sync.Mutex
	rows map[uint]model.BandwidthProfile
	seq  uint
}

func newFakeBWStore() *fakeBandwidthProfileStore {
	return &fakeBandwidthProfileStore{rows: map[uint]model.BandwidthProfile{}}
}

func (f *fakeBandwidthProfileStore) ListByDevice(ctx context.Context, deviceID uint, fil store.BandwidthProfileListFilter) ([]model.BandwidthProfile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]model.BandwidthProfile, 0)
	for _, p := range f.rows {
		if p.DeviceID != deviceID {
			continue
		}
		if fil.ServiceType != "" && p.ServiceType != fil.ServiceType {
			continue
		}
		if fil.OnlyActive && !p.Active {
			continue
		}
		out = append(out, p)
	}
	return out, nil
}

func (f *fakeBandwidthProfileStore) Get(ctx context.Context, id uint) (model.BandwidthProfile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	p, ok := f.rows[id]
	if !ok {
		return p, store.ErrBandwidthProfileNotFound
	}
	return p, nil
}

func (f *fakeBandwidthProfileStore) GetByMikrotikName(ctx context.Context, deviceID uint, serviceType, profileName string) (model.BandwidthProfile, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, p := range f.rows {
		if p.DeviceID == deviceID && p.ServiceType == serviceType && p.MikrotikProfileName == profileName {
			return p, nil
		}
	}
	return model.BandwidthProfile{}, store.ErrBandwidthProfileNotFound
}

func (f *fakeBandwidthProfileStore) Create(ctx context.Context, p *model.BandwidthProfile) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, existing := range f.rows {
		if existing.DeviceID == p.DeviceID &&
			existing.ServiceType == p.ServiceType &&
			existing.MikrotikProfileName == p.MikrotikProfileName {
			return assertUniqueErr()
		}
	}
	f.seq++
	p.ID = f.seq
	p.CreatedAt = time.Now()
	p.UpdatedAt = p.CreatedAt
	f.rows[p.ID] = *p
	return nil
}

func (f *fakeBandwidthProfileStore) Update(ctx context.Context, p *model.BandwidthProfile) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.rows[p.ID]; !ok {
		return store.ErrBandwidthProfileNotFound
	}
	p.UpdatedAt = time.Now()
	f.rows[p.ID] = *p
	return nil
}

func (f *fakeBandwidthProfileStore) Delete(ctx context.Context, id uint) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.rows[id]; !ok {
		return store.ErrBandwidthProfileNotFound
	}
	delete(f.rows, id)
	return nil
}

func (f *fakeBandwidthProfileStore) UpsertResult(ctx context.Context, p *model.BandwidthProfile) (created bool, err error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for id, existing := range f.rows {
		if existing.DeviceID == p.DeviceID &&
			existing.ServiceType == p.ServiceType &&
			existing.MikrotikProfileName == p.MikrotikProfileName {
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

// assertUniqueErr — fake duplicate-key error untuk simulasi unique
// constraint violation di in-memory store.
func assertUniqueErr() error {
	return &fakeUniqueErr{}
}

type fakeUniqueErr struct{}

func (e *fakeUniqueErr) Error() string { return "UNIQUE constraint failed: bandwidth_profiles" }

var _ store.BandwidthProfileStore = (*fakeBandwidthProfileStore)(nil)

func setupBWEngine(t *testing.T) (*gin.Engine, *fakeBandwidthProfileStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	s := newFakeBWStore()
	g := r.Group("/api/v1")
	dev := g.Group("/devices/:device_id")
	// DevMgr nil → propagate akan return "device offline" warning, DB tetap di-tulis.
	handler.NewBandwidthProfiles(s, nil, nil).Register(dev)
	return r, s
}

func TestBandwidthProfiles_Create_OK_OfflineDevice(t *testing.T) {
	r, s := setupBWEngine(t)
	w := doJSON(r, http.MethodPost, "/api/v1/devices/1/bandwidth-profiles", map[string]any{
		"service_type":          "pppoe",
		"name":                  "Paket 10M",
		"mikrotik_profile_name": "ppp-10M",
		"rate_limit":            "10M/10M",
		"price_monthly":         150000,
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"name":"Paket 10M"`)
	// DevMgr nil → warning device offline
	assert.Contains(t, w.Body.String(), "device offline")

	rows, _ := s.ListByDevice(context.Background(), 1, store.BandwidthProfileListFilter{})
	require.Len(t, rows, 1)
	assert.Equal(t, "ppp-10M", rows[0].MikrotikProfileName)
	assert.True(t, rows[0].Active, "active default true")
}

func TestBandwidthProfiles_Create_InvalidServiceType_400(t *testing.T) {
	r, _ := setupBWEngine(t)
	w := doJSON(r, http.MethodPost, "/api/v1/devices/1/bandwidth-profiles", map[string]any{
		"service_type":          "ftth", // invalid
		"name":                  "X",
		"mikrotik_profile_name": "x",
	})
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "VALIDATION")
}

func TestBandwidthProfiles_Get_NotFound(t *testing.T) {
	r, _ := setupBWEngine(t)
	w := doJSON(r, http.MethodGet, "/api/v1/devices/1/bandwidth-profiles/999", nil)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestBandwidthProfiles_Get_WrongDevice_404(t *testing.T) {
	r, _ := setupBWEngine(t)
	doJSON(r, http.MethodPost, "/api/v1/devices/1/bandwidth-profiles", map[string]any{
		"service_type": "pppoe", "name": "X", "mikrotik_profile_name": "x",
	})
	// Profile id=1 belongs to device 1, but query via device 2.
	w := doJSON(r, http.MethodGet, "/api/v1/devices/2/bandwidth-profiles/1", nil)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestBandwidthProfiles_Update_PartialFields(t *testing.T) {
	r, s := setupBWEngine(t)
	doJSON(r, http.MethodPost, "/api/v1/devices/1/bandwidth-profiles", map[string]any{
		"service_type": "pppoe", "name": "Paket A", "mikrotik_profile_name": "ppp-a", "rate_limit": "5M/5M",
	})

	newPrice := int64(99000)
	w := doJSON(r, http.MethodPut, "/api/v1/devices/1/bandwidth-profiles/1", map[string]any{
		"price_monthly": newPrice,
	})
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	p, _ := s.Get(context.Background(), 1)
	assert.Equal(t, "Paket A", p.Name, "name tidak boleh di-overwrite")
	assert.Equal(t, "5M/5M", p.RateLimit)
	assert.Equal(t, int64(99000), p.PriceMonthly)
}

func TestBandwidthProfiles_Delete(t *testing.T) {
	r, s := setupBWEngine(t)
	doJSON(r, http.MethodPost, "/api/v1/devices/1/bandwidth-profiles", map[string]any{
		"service_type": "pppoe", "name": "X", "mikrotik_profile_name": "x",
	})

	w := doJSON(r, http.MethodDelete, "/api/v1/devices/1/bandwidth-profiles/1", nil)
	// DevMgr nil → warning, status 200 dengan warning body (BUKAN 204).
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "device offline")

	_, err := s.Get(context.Background(), 1)
	assert.ErrorIs(t, err, store.ErrBandwidthProfileNotFound)
}

func TestBandwidthProfiles_Sync_NoDevMgr_503(t *testing.T) {
	r, _ := setupBWEngine(t) // DevMgr nil
	w := doJSON(r, http.MethodPost, "/api/v1/devices/1/bandwidth-profiles/sync", nil)
	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
	assert.Contains(t, w.Body.String(), "UNAVAILABLE")
}

func TestBandwidthProfiles_List_FilterByServiceType(t *testing.T) {
	r, _ := setupBWEngine(t)
	doJSON(r, http.MethodPost, "/api/v1/devices/1/bandwidth-profiles", map[string]any{
		"service_type": "pppoe", "name": "PPP1", "mikrotik_profile_name": "ppp1",
	})
	doJSON(r, http.MethodPost, "/api/v1/devices/1/bandwidth-profiles", map[string]any{
		"service_type": "hotspot", "name": "Hot1", "mikrotik_profile_name": "hot1",
	})

	w := doJSON(r, http.MethodGet, "/api/v1/devices/1/bandwidth-profiles?service_type=pppoe", nil)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"name":"PPP1"`)
	assert.NotContains(t, w.Body.String(), `"name":"Hot1"`)
}
