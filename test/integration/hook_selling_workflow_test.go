//go:build dbtest

package integration

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/service/expiry"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// sellingEnv adalah kumpulan dependency untuk test webhook selling lifecycle.
// Dibuat sekali per test oleh setupSellingEnv, lalu dipakai bersama.
type sellingEnv struct {
	DevID     uint
	ProfName  string
	DevStore  store.DeviceStore
	ProfStore store.HotspotProfileStore
	TxStore   store.TransactionStore
	MockSrv   *tcpmock.Server
	Svc       *expiry.Service
	HTTP      http.Handler
}

// setupSellingEnv menyiapkan environment lengkap untuk test webhook selling
// lifecycle tanpa memerlukan real RouterOS:
//   - PostgreSQL testcontainer (DeviceStore, HotspotProfileStore, TransactionStore)
//   - tcpmock server (RouterOS API mock, untuk expiry service)
//   - devmgr.Manager terhubung ke tcpmock
//   - Gin HTTP server dengan HookLogin + Report handler
//   - Seeded: 1 device + 1 profile config (profileName="test-profile")
func setupSellingEnv(t *testing.T, mode, validity string, price, sellPrice int) sellingEnv {
	t.Helper()
	gin.SetMode(gin.TestMode)

	devStore, profStore, txStore := testutil.NewStores(t)
	mgr, srv, dev := testutil.NewTestDevMgr(t)

	ctx := context.Background()
	dev.ExpiryCheckInterval = "100ms"
	require.NoError(t, devStore.Create(ctx, &dev))

	const profileName = "test-profile"
	_, err := profStore.Upsert(ctx, &model.HotspotProfile{
		DeviceID:   dev.ID,
		Name:       profileName,
		Role:       "voucher",
		ExpiryMode: mode,
		Validity:   validity,
		Price:      price,
		SellPrice:  sellPrice,
	})
	require.NoError(t, err)

	log := logrus.New()
	log.SetLevel(logrus.WarnLevel)
	svc := expiry.New(mgr, devStore, profStore, txStore, log)

	r := gin.New()
	g := r.Group("/api/v1")
	handler.NewHookLogin(devStore, txStore, profStore, "", log).Register(g)
	handler.NewReport(devStore, txStore).Register(g.Group("/devices/:device_id"))

	return sellingEnv{
		DevID:     dev.ID,
		ProfName:  profileName,
		DevStore:  devStore,
		ProfStore: profStore,
		TxStore:   txStore,
		MockSrv:   srv,
		Svc:       svc,
		HTTP:      r,
	}
}

// postWebhookSelling helper untuk POST /hook/hotspot/login/:device_id.
func postWebhookSelling(h http.Handler, deviceID uint, user, profile, mac, ip string) *httptest.ResponseRecorder {
	form := url.Values{
		"user": {user}, "profile": {profile}, "mac": {mac}, "ip": {ip},
	}
	req := httptest.NewRequest(http.MethodPost,
		"/api/v1/hook/hotspot/login/"+strconv.FormatUint(uint64(deviceID), 10),
		strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w
}

// runExpiryOnce menjalankan satu putaran expiry check dengan mem-Start service
// dan menunggu minimal satu tick (interval 100ms + grace 400ms).
// Tidak perlu real router — tcpmock dipakai oleh devmgr.Manager.
func runExpiryOnce(t *testing.T, svc *expiry.Service) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	require.NoError(t, svc.Start(ctx))
	time.Sleep(500 * time.Millisecond)
}

// TestIntegration_HookSelling_remc_firstLogin: login pertama mode remc
// harus mencatat 1 transaksi ke PostgreSQL.
func TestIntegration_HookSelling_remc_firstLogin(t *testing.T) {
	env := setupSellingEnv(t, "remc", "1d", 5000, 7000)
	ctx := context.Background()

	w := postWebhookSelling(env.HTTP, env.DevID, "alice", env.ProfName, "AA:BB:CC:DD:EE:FF", "10.0.0.1")
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"recorded":true`)

	txs, err := env.TxStore.ListByDevice(ctx, env.DevID, "")
	require.NoError(t, err)
	require.Len(t, txs, 1)
	assert.Equal(t, "alice", txs[0].Username)
	assert.Equal(t, env.ProfName, txs[0].Profile)
	assert.Equal(t, 5000, txs[0].Price)
	assert.Equal(t, 7000, txs[0].SellPrice)
	assert.Equal(t, handler.LoginEventComment, txs[0].Comment)
}

// TestIntegration_HookSelling_remc_dedupRelogin: re-login dalam window validity
// tidak boleh menghasilkan transaksi ganda (user reconnect = bukan pembelian baru).
func TestIntegration_HookSelling_remc_dedupRelogin(t *testing.T) {
	env := setupSellingEnv(t, "remc", "1d", 5000, 7000)
	ctx := context.Background()

	// Login pertama — ter-record.
	w1 := postWebhookSelling(env.HTTP, env.DevID, "alice", env.ProfName, "AA:BB:CC:DD:EE:FF", "10.0.0.1")
	require.Equal(t, http.StatusOK, w1.Code)
	assert.Contains(t, w1.Body.String(), `"recorded":true`)

	// Re-login dalam window 1d — dedup memblokir.
	w2 := postWebhookSelling(env.HTTP, env.DevID, "alice", env.ProfName, "AA:BB:CC:DD:EE:FF", "10.0.0.1")
	require.Equal(t, http.StatusOK, w2.Code)
	assert.Contains(t, w2.Body.String(), `"recorded":false`)
	assert.Contains(t, w2.Body.String(), `"already_recorded"`)

	txs, err := env.TxStore.ListByDevice(ctx, env.DevID, "")
	require.NoError(t, err)
	assert.Len(t, txs, 1, "re-login dalam window tidak boleh insert TX ganda")
}

// TestIntegration_HookSelling_remc_newPurchaseAfterWindow: login setelah window
// validity habis harus ter-record sebagai pembelian baru.
// Memakai validity="1s" supaya tidak perlu sleep lama.
func TestIntegration_HookSelling_remc_newPurchaseAfterWindow(t *testing.T) {
	env := setupSellingEnv(t, "remc", "1s", 5000, 7000)
	ctx := context.Background()

	// Login pertama.
	w1 := postWebhookSelling(env.HTTP, env.DevID, "alice", env.ProfName, "AA:BB:CC:DD:EE:FF", "10.0.0.1")
	require.Equal(t, http.StatusOK, w1.Code)
	assert.Contains(t, w1.Body.String(), `"recorded":true`)

	// Tunggu hingga window validity (1s) habis.
	time.Sleep(1500 * time.Millisecond)

	// Login lagi setelah window — pembelian baru, harus ter-record.
	w2 := postWebhookSelling(env.HTTP, env.DevID, "alice", env.ProfName, "AA:BB:CC:DD:EE:FF", "10.0.0.1")
	require.Equal(t, http.StatusOK, w2.Code)
	assert.Contains(t, w2.Body.String(), `"recorded":true`, "pembelian baru setelah window harus ter-record")

	txs, err := env.TxStore.ListByDevice(ctx, env.DevID, "")
	require.NoError(t, err)
	assert.Len(t, txs, 2, "harus ada 2 record: voucher lama dan voucher baru")
}

// TestIntegration_HookSelling_rem_notRecorded: mode rem (remove only) tidak boleh
// mencatat penjualan apapun saat user login.
func TestIntegration_HookSelling_rem_notRecorded(t *testing.T) {
	env := setupSellingEnv(t, "rem", "1d", 5000, 7000)
	ctx := context.Background()

	w := postWebhookSelling(env.HTTP, env.DevID, "bob", env.ProfName, "11:22:33:44:55:66", "10.0.0.2")
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"non_recording_mode"`)

	txs, err := env.TxStore.ListByDevice(ctx, env.DevID, "")
	require.NoError(t, err)
	assert.Empty(t, txs, "mode rem tidak boleh menghasilkan transaksi")
}

// TestIntegration_HookSelling_ntfc_recorded: mode ntfc (notice+record) harus
// mencatat transaksi saat login.
func TestIntegration_HookSelling_ntfc_recorded(t *testing.T) {
	env := setupSellingEnv(t, "ntfc", "1d", 5000, 7000)
	ctx := context.Background()

	w := postWebhookSelling(env.HTTP, env.DevID, "carol", env.ProfName, "CC:CC:CC:CC:CC:CC", "10.0.0.3")
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"recorded":true`)

	txs, err := env.TxStore.ListByDevice(ctx, env.DevID, "")
	require.NoError(t, err)
	require.Len(t, txs, 1)
	assert.Equal(t, "carol", txs[0].Username)
}

// TestIntegration_HookSelling_expiryNoExtraRecord: ini adalah test paling kritis —
// memverifikasi tidak ada double-counting setelah bug fix.
//
// Flow:
//  1. User login → webhook mencatat 1 TX (comment="login")
//  2. Expiry service mendeteksi user expired via tcpmock
//  3. Expiry service menghapus user dari router
//  4. DB harus tetap 1 TX (bukan 2) — expiry service tidak boleh tambah record
func TestIntegration_HookSelling_expiryNoExtraRecord(t *testing.T) {
	env := setupSellingEnv(t, "remc", "1d", 5000, 7000)
	ctx := context.Background()

	// Step 1: user login → 1 TX dari webhook.
	w := postWebhookSelling(env.HTTP, env.DevID, "dave", env.ProfName, "DD:DD:DD:DD:DD:DD", "10.0.0.4")
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"recorded":true`)

	// Verifikasi awal: 1 TX di DB.
	txsBefore, err := env.TxStore.ListByDevice(ctx, env.DevID, "")
	require.NoError(t, err)
	require.Len(t, txsBefore, 1, "sebelum expiry: harus ada 1 TX dari webhook")

	// Step 2: setup tcpmock — simulasi user "dave" expired di router.
	past := time.Now().Add(-48 * time.Hour)
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/print"),
		tcpmock.UserPrintExpired("1", "dave", env.ProfName, past),
		tcpmock.DoneReply(),
	)
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/system/script/print"), tcpmock.DoneReply())
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/system/scheduler/print"), tcpmock.DoneReply())
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/remove"), tcpmock.DoneReply())

	// Step 3: jalankan expiry service — harus hapus user, TIDAK tambah TX.
	runExpiryOnce(t, env.Svc)

	// Verifikasi: router menerima perintah remove.
	env.MockSrv.AssertReceived(t,
		tcpmock.MatchAll(
			tcpmock.MatchCommand("/ip/hotspot/user/remove"),
			tcpmock.MatchHas("numbers", "*1"),
		),
		"expiry harus mengirim /ip/hotspot/user/remove ke router",
	)

	// Verifikasi kritis: DB tetap 1 TX, tidak ada double-counting.
	txsAfter, err := env.TxStore.ListByDevice(ctx, env.DevID, "")
	require.NoError(t, err)
	assert.Len(t, txsAfter, 1, "expiry service tidak boleh menambah TX; harus tetap 1")
	assert.Equal(t, handler.LoginEventComment, txsAfter[0].Comment,
		"satu-satunya TX harus dari webhook login, bukan expiry-auto")
}

// TestIntegration_HookSelling_reportSummary: verifikasi endpoint laporan
// mengembalikan agregat yang benar dari transaksi di PostgreSQL.
func TestIntegration_HookSelling_reportSummary(t *testing.T) {
	env := setupSellingEnv(t, "remc", "1d", 5000, 7000)
	ctx := context.Background()
	now := time.Now()
	month := strings.ToLower(now.Format("Jan2006"))

	// Seed transaksi langsung ke store (bypass webhook, fokus ke report logic).
	for i := 0; i < 3; i++ {
		require.NoError(t, env.TxStore.Create(ctx, &model.Transaction{
			DeviceID:  env.DevID,
			SaleDate:  strings.ToLower(now.Format("Jan/02/2006")),
			SaleTime:  now.Format("15:04:05"),
			SaleMonth: month,
			Username:  "user" + strconv.Itoa(i),
			Profile:   "1day",
			Price:     5000,
			SellPrice: 7000,
			Comment:   handler.LoginEventComment,
		}))
	}
	for i := 0; i < 2; i++ {
		require.NoError(t, env.TxStore.Create(ctx, &model.Transaction{
			DeviceID:  env.DevID,
			SaleDate:  strings.ToLower(now.Format("Jan/02/2006")),
			SaleTime:  now.Format("15:04:05"),
			SaleMonth: month,
			Username:  "vip" + strconv.Itoa(i),
			Profile:   "7day",
			Price:     20000,
			SellPrice: 25000,
			Comment:   handler.LoginEventComment,
		}))
	}

	// GET /api/v1/devices/{id}/reports/selling/summary?month=...
	path := "/api/v1/devices/" + strconv.FormatUint(uint64(env.DevID), 10) +
		"/reports/selling/summary?month=" + month
	req := httptest.NewRequest(http.MethodGet, path, nil)
	w := httptest.NewRecorder()
	env.HTTP.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var resp struct {
		Data struct {
			Count          int            `json:"count"`
			TotalPrice     int            `json:"total_price"`
			TotalSellPrice int            `json:"total_sell_price"`
			Profit         int            `json:"profit"`
			ByProfile      map[string]int `json:"by_profile"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))

	// 3×"1day" (price=5000, sell=7000) + 2×"7day" (price=20000, sell=25000)
	// TotalPrice     = 3×5000  + 2×20000 = 55000
	// TotalSellPrice = 3×7000  + 2×25000 = 71000
	// Profit         = 71000 - 55000     = 16000
	assert.Equal(t, 5, resp.Data.Count)
	assert.Equal(t, 55000, resp.Data.TotalPrice)
	assert.Equal(t, 71000, resp.Data.TotalSellPrice)
	assert.Equal(t, 16000, resp.Data.Profit)
	assert.Equal(t, 3, resp.Data.ByProfile["1day"])
	assert.Equal(t, 2, resp.Data.ByProfile["7day"])
}
