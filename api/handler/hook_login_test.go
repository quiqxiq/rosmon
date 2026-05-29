package handler_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// fakeDeviceStore — minimal stub untuk hook handler. Hanya method Get
// yang dipakai webhook handler; sisanya return error supaya kalau ada
// usage tak terduga, test fail eksplisit.
type fakeDeviceStore struct {
	devices map[uint]model.MikrotikDevice
}

func newFakeDeviceStore(ids ...uint) *fakeDeviceStore {
	m := make(map[uint]model.MikrotikDevice, len(ids))
	for _, id := range ids {
		m[id] = model.MikrotikDevice{ID: id}
	}
	return &fakeDeviceStore{devices: m}
}

func (f *fakeDeviceStore) Get(ctx context.Context, id uint) (model.MikrotikDevice, error) {
	if d, ok := f.devices[id]; ok {
		return d, nil
	}
	return model.MikrotikDevice{}, gorm.ErrRecordNotFound
}

// Stub method-method lain (tidak dipakai webhook). Kalau di-call, test
// akan fail dengan pesan jelas.
func (f *fakeDeviceStore) List(ctx context.Context) ([]model.MikrotikDevice, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeDeviceStore) ListAll(ctx context.Context) ([]model.MikrotikDevice, error) {
	return nil, errors.New("not implemented")
}
func (f *fakeDeviceStore) Create(ctx context.Context, d *model.MikrotikDevice) error {
	return errors.New("not implemented")
}
func (f *fakeDeviceStore) Update(ctx context.Context, d *model.MikrotikDevice) error {
	return errors.New("not implemented")
}
func (f *fakeDeviceStore) Delete(ctx context.Context, id uint) error {
	return errors.New("not implemented")
}
func (f *fakeDeviceStore) UpdateStatus(ctx context.Context, id uint, status, lastError string, lastSeen *time.Time) error {
	return errors.New("not implemented")
}
func (f *fakeDeviceStore) UpdateTimezone(ctx context.Context, id uint, tz string) error {
	return errors.New("not implemented")
}

// fakeTxStore — in-memory transaction store untuk webhook test.
type fakeTxStore struct {
	mu  sync.Mutex
	txs []model.Transaction
}

func newFakeTxStore() *fakeTxStore { return &fakeTxStore{} }

func (f *fakeTxStore) Create(ctx context.Context, tx *model.Transaction) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	tx.ID = uint(len(f.txs) + 1)
	tx.CreatedAt = time.Now()
	f.txs = append(f.txs, *tx)
	return nil
}

func (f *fakeTxStore) ListByDevice(ctx context.Context, deviceID uint, month string) ([]model.Transaction, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]model.Transaction, 0)
	for _, t := range f.txs {
		if t.DeviceID == deviceID && (month == "" || t.SaleMonth == month) {
			out = append(out, t)
		}
	}
	return out, nil
}

func (f *fakeTxStore) ListByDeviceDate(ctx context.Context, deviceID uint, date string) ([]model.Transaction, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]model.Transaction, 0)
	for _, t := range f.txs {
		if t.DeviceID == deviceID && t.SaleDate == date {
			out = append(out, t)
		}
	}
	return out, nil
}

func (f *fakeTxStore) ExistsByUserComment(ctx context.Context, deviceID uint, username, comment string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, t := range f.txs {
		if t.DeviceID == deviceID && t.Username == username && t.Comment == comment {
			return true, nil
		}
	}
	return false, nil
}

func (f *fakeTxStore) ExistsByUserCommentSince(ctx context.Context, deviceID uint, username, comment string, since time.Time) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, t := range f.txs {
		if t.DeviceID == deviceID && t.Username == username && t.Comment == comment && t.CreatedAt.After(since) {
			return true, nil
		}
	}
	return false, nil
}

// setupHookLoginEngine bangun gin engine + dependencies untuk webhook test.
// Seed: device id=1, profile_config (1, "1day") = mode "remc" price=5000.
func setupHookLoginEngine(t *testing.T) (*gin.Engine, *fakeTxStore, *fakeProfileConfigStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()

	devStore := newFakeDeviceStore(1)
	txStore := newFakeTxStore()
	profStore := newFakeProfileConfigStore()

	// Seed profile configs untuk berbagai mode.
	profiles := []model.HotspotProfile{
		{DeviceID: 1, Name: "1day", Role: "voucher", ExpiryMode: "remc", Validity: "1d", Price: 5000, SellPrice: 7000},
		{DeviceID: 1, Name: "1day-ntfc", Role: "voucher", ExpiryMode: "ntfc", Validity: "1d", Price: 5000, SellPrice: 7000},
		{DeviceID: 1, Name: "rem-only", Role: "voucher", ExpiryMode: "rem", Validity: "1d"},
		{DeviceID: 1, Name: "ntf-only", Role: "voucher", ExpiryMode: "ntf", Validity: "1d"},
		{DeviceID: 1, Name: "free", Role: "voucher", ExpiryMode: "0"},
	}
	for i := range profiles {
		_, err := profStore.Upsert(context.Background(), &profiles[i])
		require.NoError(t, err)
	}

	g := r.Group("/api/v1")
	handler.NewHookLogin(devStore, txStore, profStore, nil).Register(g)
	return r, txStore, profStore
}

// postLoginHook helper untuk POST form-encoded.
func postLoginHook(r *gin.Engine, deviceID string, form url.Values) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost,
		"/api/v1/hook/hotspot/login/"+deviceID,
		strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestHookLogin_FirstLogin_Records(t *testing.T) {
	r, txStore, _ := setupHookLoginEngine(t)

	form := url.Values{}
	form.Set("user", "vc-12345")
	form.Set("mac", "AA:BB:CC:DD:EE:FF")
	form.Set("ip", "10.0.0.5")
	form.Set("profile", "1day")

	w := postLoginHook(r, "1", form)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"recorded":true`)

	txs, _ := txStore.ListByDevice(context.Background(), 1, "")
	require.Len(t, txs, 1)
	tx := txs[0]
	assert.Equal(t, "vc-12345", tx.Username)
	assert.Equal(t, "1day", tx.Profile)
	assert.Equal(t, 5000, tx.Price)
	assert.Equal(t, 7000, tx.SellPrice)
	assert.Equal(t, "AA:BB:CC:DD:EE:FF", tx.MAC)
	assert.Equal(t, "10.0.0.5", tx.IP)
	assert.Equal(t, handler.LoginEventComment, tx.Comment)
}

func TestHookLogin_ReLogin_Dedup(t *testing.T) {
	r, txStore, _ := setupHookLoginEngine(t)

	form := url.Values{}
	form.Set("user", "vc-12345")
	form.Set("mac", "AA:BB:CC:DD:EE:FF")
	form.Set("ip", "10.0.0.5")
	form.Set("profile", "1day")

	// First login → recorded.
	postLoginHook(r, "1", form)
	// Second login → should be deduped.
	w2 := postLoginHook(r, "1", form)
	require.Equal(t, http.StatusOK, w2.Code)
	assert.Contains(t, w2.Body.String(), `"recorded":false`)
	assert.Contains(t, w2.Body.String(), `"already_recorded"`)

	txs, _ := txStore.ListByDevice(context.Background(), 1, "")
	assert.Len(t, txs, 1, "second login must not insert duplicate")
}

func TestHookLogin_FreeProfile_Skips(t *testing.T) {
	r, txStore, _ := setupHookLoginEngine(t)

	form := url.Values{}
	form.Set("user", "guest-1")
	form.Set("profile", "free")

	w := postLoginHook(r, "1", form)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"non_recording_mode"`)
	txs, _ := txStore.ListByDevice(context.Background(), 1, "")
	assert.Empty(t, txs, "free profile must not record selling")
}

func TestHookLogin_rem_notRecorded(t *testing.T) {
	r, txStore, _ := setupHookLoginEngine(t)

	form := url.Values{"user": {"alice"}, "profile": {"rem-only"}, "mac": {"AA:BB:CC:DD:EE:FF"}, "ip": {"10.0.0.1"}}
	w := postLoginHook(r, "1", form)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"non_recording_mode"`, "rem tidak boleh record penjualan")
	txs, _ := txStore.ListByDevice(context.Background(), 1, "")
	assert.Empty(t, txs)
}

func TestHookLogin_ntf_notRecorded(t *testing.T) {
	r, txStore, _ := setupHookLoginEngine(t)

	form := url.Values{"user": {"alice"}, "profile": {"ntf-only"}}
	w := postLoginHook(r, "1", form)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"non_recording_mode"`, "ntf tidak boleh record penjualan")
	txs, _ := txStore.ListByDevice(context.Background(), 1, "")
	assert.Empty(t, txs)
}

func TestHookLogin_ntfc_recorded(t *testing.T) {
	r, txStore, _ := setupHookLoginEngine(t)

	form := url.Values{"user": {"bob"}, "profile": {"1day-ntfc"}, "mac": {"11:22:33:44:55:66"}, "ip": {"10.0.0.2"}}
	w := postLoginHook(r, "1", form)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"recorded":true`)
	txs, _ := txStore.ListByDevice(context.Background(), 1, "")
	require.Len(t, txs, 1)
	assert.Equal(t, "bob", txs[0].Username)
	assert.Equal(t, "1day-ntfc", txs[0].Profile)
}

// TestHookLogin_remc_recordsAfterWindow memverifikasi bahwa login setelah window
// validity habis (simulasi pembelian voucher baru) tetap ter-record.
// Dicapai dengan meng-inject transaksi lama yang CreatedAt-nya di luar window.
func TestHookLogin_remc_recordsAfterWindow(t *testing.T) {
	r, txStore, _ := setupHookLoginEngine(t)

	// Inject transaksi "lama" (2 hari yang lalu) secara langsung ke fake store.
	// Window validity profile "1day" = 1 hari, jadi record ini sudah di luar window.
	txStore.mu.Lock()
	txStore.txs = append(txStore.txs, model.Transaction{
		ID:        1,
		DeviceID:  1,
		Username:  "carol",
		Comment:   handler.LoginEventComment,
		CreatedAt: time.Now().Add(-48 * time.Hour), // di luar window 1d
	})
	txStore.mu.Unlock()

	form := url.Values{"user": {"carol"}, "profile": {"1day"}, "mac": {"CC:CC:CC:CC:CC:CC"}}
	w := postLoginHook(r, "1", form)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"recorded":true`, "pembelian baru setelah window harus ter-record")

	txs, _ := txStore.ListByDevice(context.Background(), 1, "")
	assert.Len(t, txs, 2, "harus ada 2 record: lama + baru")
}

func TestHookLogin_ProfileNotConfigured_Skips(t *testing.T) {
	r, txStore, _ := setupHookLoginEngine(t)

	form := url.Values{}
	form.Set("user", "vc-1")
	form.Set("profile", "unknown-profile")

	w := postLoginHook(r, "1", form)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"profile_not_configured"`)
	txs, _ := txStore.ListByDevice(context.Background(), 1, "")
	assert.Empty(t, txs)
}

func TestHookLogin_DeviceNotFound_Returns404(t *testing.T) {
	r, _, _ := setupHookLoginEngine(t)

	form := url.Values{}
	form.Set("user", "vc-1")
	form.Set("profile", "1day")

	w := postLoginHook(r, "999", form)
	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.Contains(t, w.Body.String(), "DEVICE_NOT_FOUND")
}

func TestHookLogin_MissingUser_Returns400(t *testing.T) {
	r, _, _ := setupHookLoginEngine(t)

	form := url.Values{}
	form.Set("profile", "1day")
	// user kosong

	w := postLoginHook(r, "1", form)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "VALIDATION")
}

func TestHookLogin_MissingProfile_Skips(t *testing.T) {
	r, txStore, _ := setupHookLoginEngine(t)

	form := url.Values{}
	form.Set("user", "vc-1")
	// profile kosong → skip recording, return 200 supaya router tidak retry.

	w := postLoginHook(r, "1", form)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"missing_profile"`)
	txs, _ := txStore.ListByDevice(context.Background(), 1, "")
	assert.Empty(t, txs)
}

func TestHookLogin_InvalidDeviceID_Returns400(t *testing.T) {
	r, _, _ := setupHookLoginEngine(t)

	form := url.Values{}
	form.Set("user", "vc-1")

	w := postLoginHook(r, "abc", form)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "INVALID_ID")
}

// Sanity check: handler tidak crash kalau payload sangat panjang.
// Field di-truncate sebelum disimpan ke DB.
func TestHookLogin_LongPayload_Truncated(t *testing.T) {
	r, txStore, _ := setupHookLoginEngine(t)

	form := url.Values{}
	form.Set("user", strings.Repeat("a", 500))
	form.Set("mac", strings.Repeat("M", 100))
	form.Set("ip", strings.Repeat("9", 100))
	form.Set("profile", "1day")

	w := postLoginHook(r, "1", form)
	require.Equal(t, http.StatusOK, w.Code)

	txs, _ := txStore.ListByDevice(context.Background(), 1, "")
	require.Len(t, txs, 1)
	assert.Len(t, txs[0].Username, 128, "username truncated to 128 chars")
	assert.Len(t, txs[0].MAC, 17)
	assert.Len(t, txs[0].IP, 45)
}

// Compile-time interface checks.
var _ store.DeviceStore = (*fakeDeviceStore)(nil)
var _ store.TransactionStore = (*fakeTxStore)(nil)
