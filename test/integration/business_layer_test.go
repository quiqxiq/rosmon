//go:build dbtest

package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/service/devmgr"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/quiqxiq/rosmon/workflows"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// businessEnv adalah dependency lengkap untuk test business layer
// (customer + bandwidth_profile + subscription) tanpa real RouterOS.
type businessEnv struct {
	DB         *gorm.DB
	CustStore  store.CustomerStore
	BWStore    store.BandwidthProfileStore
	SubStore   store.SubscriptionStore
	DevStore   store.DeviceStore
	Mgr        *devmgr.Manager
	MockSrv    *tcpmock.Server
	Device     model.MikrotikDevice
	HTTP       http.Handler
}

// setupBusinessEnv menyiapkan postgres testcontainer + tcpmock router +
// devmgr + gin engine dengan customer/bandwidth_profile/subscription
// handlers terdaftar. Auth disable supaya test fokus ke flow data.
func setupBusinessEnv(t *testing.T) businessEnv {
	t.Helper()
	gin.SetMode(gin.TestMode)

	// Aktifkan enkripsi password supaya MikrotikPassword di-encrypt at rest.
	// Key all-zero (32 byte) khusus untuk test — production wajib pakai key
	// random dari env DEVICE_PASSWORD_KEY. SetDeviceCryptoKey idempotent
	// dan aman dipanggil dari setiap setup (package-level var).
	require.NoError(t, store.SetDeviceCryptoKey(make([]byte, 32)))

	db := testutil.NewPostgres(t)
	devStore := store.NewDeviceStore(db)
	custStore := store.NewCustomerStore(db)
	bwStore := store.NewBandwidthProfileStore(db)
	subStore := store.NewSubscriptionStore(db)

	mgr, srv, dev := testutil.NewTestDevMgr(t)
	ctx := context.Background()
	require.NoError(t, devStore.Create(ctx, &dev))

	log := logrus.New()
	log.SetLevel(logrus.WarnLevel)

	r := gin.New()
	g := r.Group("/api/v1")
	handler.NewCustomers(custStore).Register(g)

	bwScope := g.Group("/devices/:device_id")
	handler.NewBandwidthProfiles(bwStore, mgr, log).Register(bwScope)
	handler.NewSubscriptions(subStore, custStore, bwStore, mgr, log).Register(g)

	return businessEnv{
		DB: db, CustStore: custStore, BWStore: bwStore, SubStore: subStore,
		DevStore: devStore, Mgr: mgr, MockSrv: srv, Device: dev, HTTP: r,
	}
}

func httpJSON(h http.Handler, method, path string, body any) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w
}

// decodeOK extract data field dari envelope {data:..., meta:...}.
func decodeOK(t *testing.T, w *httptest.ResponseRecorder, target any) {
	t.Helper()
	var env struct {
		Data json.RawMessage `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &env), "body: %s", w.Body.String())
	require.NoError(t, json.Unmarshal(env.Data, target))
}

// ── Customer lifecycle (DB only) ────────────────────────────────────────

func TestIntegration_Customer_FullLifecycle(t *testing.T) {
	env := setupBusinessEnv(t)

	// CREATE
	w := httpJSON(env.HTTP, http.MethodPost, "/api/v1/customers", map[string]any{
		"full_name": "Pak Budi",
		"phone":     "0811000111",
		"address":   "Jl. Mawar 1",
		"area":      "RT01",
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	var created struct{ ID uint `json:"id"` }
	decodeOK(t, w, &created)
	require.NotZero(t, created.ID)

	// GET
	w = httpJSON(env.HTTP, http.MethodGet, fmt.Sprintf("/api/v1/customers/%d", created.ID), nil)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"full_name":"Pak Budi"`)
	assert.Contains(t, w.Body.String(), `"status":"aktif"`)

	// LIST with filter
	w = httpJSON(env.HTTP, http.MethodGet, "/api/v1/customers?area=RT01", nil)
	require.Equal(t, http.StatusOK, w.Code)
	var listResp struct {
		Data []struct {
			ID    uint   `json:"id"`
			Phone string `json:"phone"`
		} `json:"data"`
		Meta struct{ Count int `json:"count"` } `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &listResp))
	assert.Equal(t, 1, listResp.Meta.Count)

	// UPDATE — sparse, only address
	w = httpJSON(env.HTTP, http.MethodPut, fmt.Sprintf("/api/v1/customers/%d", created.ID), map[string]any{
		"address": "Jl. Anggrek 99",
	})
	require.Equal(t, http.StatusOK, w.Code)
	cust, err := env.CustStore.Get(context.Background(), created.ID)
	require.NoError(t, err)
	assert.Equal(t, "Jl. Anggrek 99", cust.Address)
	assert.Equal(t, "Pak Budi", cust.FullName, "full_name harus tetap")

	// DUPLICATE PHONE → 409
	w = httpJSON(env.HTTP, http.MethodPost, "/api/v1/customers", map[string]any{
		"full_name": "Lain",
		"phone":     "0811000111",
	})
	assert.Equal(t, http.StatusConflict, w.Code)

	// DELETE
	w = httpJSON(env.HTTP, http.MethodDelete, fmt.Sprintf("/api/v1/customers/%d", created.ID), nil)
	require.Equal(t, http.StatusNoContent, w.Code)

	// GET after delete → 404 (soft delete)
	w = httpJSON(env.HTTP, http.MethodGet, fmt.Sprintf("/api/v1/customers/%d", created.ID), nil)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

// ── Bandwidth profile Sync — tarik dari mock router ─────────────────────

func TestIntegration_BandwidthProfile_SyncFromRouter(t *testing.T) {
	env := setupBusinessEnv(t)

	// Mock router merespons dengan 2 PPP profile + 1 hotspot profile.
	// PPP profile field lengkap (local-address, remote-address, dst.) untuk
	// verify Sync handler copy semua field service-specific.
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ppp/profile/print"),
		tcpmock.ReReply("=.id=*1", "=name=default", "=rate-limit="),
		tcpmock.ReReply(
			"=.id=*2",
			"=name=paket-10M",
			"=rate-limit=10M/10M",
			"=local-address=10.10.0.1",
			"=remote-address=pool-rumah",
			"=session-timeout=12h",
			"=idle-timeout=10m",
			"=parent-queue=queue-rumah",
		),
		tcpmock.DoneReply(),
	)
	// Hotspot profile field lengkap (address-pool, shared-users).
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/profile/print"),
		tcpmock.ReReply(
			"=.id=*A1",
			"=name=guest",
			"=rate-limit=1M/1M",
			"=address-pool=hs-pool",
			"=shared-users=3",
			"=parent-queue=queue-hotspot",
		),
		tcpmock.DoneReply(),
	)

	w := httpJSON(env.HTTP, http.MethodPost,
		fmt.Sprintf("/api/v1/devices/%d/bandwidth-profiles/sync", env.Device.ID), nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var resp struct {
		Data struct {
			Synced  []string `json:"synced"`
			Created []string `json:"created"`
			Orphan  []string `json:"orphan"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))

	// First sync: semua dari router → masuk Created[].
	assert.ElementsMatch(t,
		[]string{"pppoe/default", "pppoe/paket-10M", "hotspot/guest"},
		resp.Data.Created)
	assert.Empty(t, resp.Data.Synced, "first sync — semua baru")
	assert.Empty(t, resp.Data.Orphan)

	// Verifikasi: 3 row di DB dengan rate_limit terisi.
	rows, err := env.BWStore.ListByDevice(context.Background(), env.Device.ID, store.BandwidthProfileListFilter{})
	require.NoError(t, err)
	require.Len(t, rows, 3)
	byName := map[string]model.BandwidthProfile{}
	for _, r := range rows {
		byName[r.ServiceType+"/"+r.MikrotikProfileName] = r
	}
	// PPPoE service-specific field harus ter-import.
	ppp := byName["pppoe/paket-10M"]
	assert.Equal(t, "10M/10M", ppp.RateLimit)
	assert.Equal(t, "10.10.0.1", ppp.LocalAddress)
	assert.Equal(t, "pool-rumah", ppp.RemoteAddress)
	assert.Equal(t, "12h", ppp.SessionTimeout)
	assert.Equal(t, "10m", ppp.IdleTimeout)
	assert.Equal(t, "queue-rumah", ppp.ParentQueue)
	assert.True(t, ppp.Active, "sync default active=true")

	// Hotspot service-specific field harus ter-import.
	hot := byName["hotspot/guest"]
	assert.Equal(t, "1M/1M", hot.RateLimit)
	assert.Equal(t, "hs-pool", hot.AddressPool)
	assert.Equal(t, 3, hot.SharedUsers)
	assert.Equal(t, "queue-hotspot", hot.ParentQueue)

	// Sync kedua: same router state → semua masuk Synced[], tidak ada Created baru.
	w = httpJSON(env.HTTP, http.MethodPost,
		fmt.Sprintf("/api/v1/devices/%d/bandwidth-profiles/sync", env.Device.ID), nil)
	require.Equal(t, http.StatusOK, w.Code)
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	assert.ElementsMatch(t,
		[]string{"pppoe/default", "pppoe/paket-10M", "hotspot/guest"},
		resp.Data.Synced)
	assert.Empty(t, resp.Data.Created)
}

// ── Subscription full lifecycle ─────────────────────────────────────────

func TestIntegration_Subscription_FullLifecycle(t *testing.T) {
	env := setupBusinessEnv(t)
	ctx := context.Background()

	// Seed: 1 customer + 1 bandwidth profile pppoe.
	cust := &model.Customer{FullName: "Pak Joko", Phone: "08222333", Status: "aktif"}
	require.NoError(t, env.CustStore.Create(ctx, cust))
	bp := &model.BandwidthProfile{
		DeviceID: env.Device.ID, ServiceType: "pppoe",
		Name: "Paket Rumah", MikrotikProfileName: "ppp-home",
		RateLimit: "20M/20M", PriceMonthly: 250000, Active: true,
	}
	require.NoError(t, env.BWStore.Create(ctx, bp))

	// Mock router: SecretAdd berhasil, return ID *S1.
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ppp/secret/add"),
		tcpmock.DoneReply("=ret=*S1"))
	// SecretByName lookup — return existing secret with id *S1.
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ppp/secret/print"),
		tcpmock.ReReply("=.id=*S1", "=name=joko-001", "=service=pppoe", "=profile=ppp-home", "=disabled=false"),
		tcpmock.DoneReply(),
	)
	// SecretSet (disable/enable / update password).
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ppp/secret/set"), tcpmock.DoneReply())
	// SecretRemove untuk terminate.
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ppp/secret/remove"), tcpmock.DoneReply())

	// ── 1. CREATE — provision di router (best-effort sukses) ────────────
	w := httpJSON(env.HTTP, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"customer_id":          cust.ID,
		"device_id":            env.Device.ID,
		"bandwidth_profile_id": bp.ID,
		"service_type":         "pppoe",
		"mikrotik_username":    "joko-001",
		"mikrotik_password":    "rahasia",
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	assert.NotContains(t, w.Body.String(), `"warning"`, "create harus sukses tanpa warning")
	// Auto-upgrade ke active karena provision sukses.
	assert.Contains(t, w.Body.String(), `"status":"active"`)

	var createResp struct {
		Data struct {
			Subscription struct{ ID uint `json:"id"` } `json:"subscription"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &createResp))
	subID := createResp.Data.Subscription.ID
	require.NotZero(t, subID)

	// Verifikasi router menerima /ppp/secret/add dengan field benar.
	env.MockSrv.AssertReceived(t, tcpmock.MatchAll(
		tcpmock.MatchCommand("/ppp/secret/add"),
		tcpmock.MatchHas("name", "joko-001"),
		tcpmock.MatchHas("password", "rahasia"),
		tcpmock.MatchHas("service", "pppoe"),
		tcpmock.MatchHas("profile", "ppp-home"),
	), "secret add dengan field lengkap")

	// Verifikasi DB: subscription tersimpan, password ter-encrypt at rest.
	subDB, err := env.SubStore.Get(ctx, subID)
	require.NoError(t, err)
	assert.Equal(t, "active", subDB.Status)
	assert.NotNil(t, subDB.ActivatedAt)
	assert.Equal(t, "rahasia", subDB.MikrotikPassword,
		"store.Get harus return plaintext setelah decrypt")

	// Cek raw DB row — pastikan password ter-encrypt (hex-encoded panjang).
	var rawPass string
	require.NoError(t, env.DB.Raw("SELECT mikrotik_password FROM subscriptions WHERE id = ?", subID).
		Row().Scan(&rawPass))
	assert.NotEqual(t, "rahasia", rawPass, "raw DB row harus encrypted")
	assert.Greater(t, len(rawPass), 20, "encrypted password lebih panjang dari plaintext")

	// ── 2. PATCH status → isolir → verify SecretSet dengan disabled=true ──
	w = httpJSON(env.HTTP, http.MethodPatch,
		fmt.Sprintf("/api/v1/subscriptions/%d/status", subID),
		map[string]any{"status": "isolir"})
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"status":"isolir"`)

	// Router harus terima set dengan disabled=true.
	env.MockSrv.AssertReceived(t, tcpmock.MatchAll(
		tcpmock.MatchCommand("/ppp/secret/set"),
		tcpmock.MatchHas("disabled", "yes"),
	), "isolir → SecretSet disabled=yes")

	// ── 3. PATCH status → active → verify SecretSet dengan disabled=false ──
	w = httpJSON(env.HTTP, http.MethodPatch,
		fmt.Sprintf("/api/v1/subscriptions/%d/status", subID),
		map[string]any{"status": "active"})
	require.Equal(t, http.StatusOK, w.Code)
	env.MockSrv.AssertReceived(t, tcpmock.MatchAll(
		tcpmock.MatchCommand("/ppp/secret/set"),
		tcpmock.MatchHas("disabled", "no"),
	), "active → SecretSet disabled=no")

	// ── 4. RECONCILE → ensure-exists + set attrs ────────────────────────
	w = httpJSON(env.HTTP, http.MethodPost,
		fmt.Sprintf("/api/v1/subscriptions/%d/reconcile", subID), nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	// ── 5. PATCH status → terminated → verify SecretRemove ──────────────
	w = httpJSON(env.HTTP, http.MethodPatch,
		fmt.Sprintf("/api/v1/subscriptions/%d/status", subID),
		map[string]any{"status": "terminated"})
	require.Equal(t, http.StatusOK, w.Code)

	env.MockSrv.AssertReceived(t, tcpmock.MatchCommand("/ppp/secret/remove"),
		"terminated → SecretRemove")

	subDB, err = env.SubStore.Get(ctx, subID)
	require.NoError(t, err)
	assert.Equal(t, "terminated", subDB.Status)
	require.NotNil(t, subDB.TerminatedAt)
}

// ── Subscription validation gates ───────────────────────────────────────

func TestIntegration_Subscription_ServiceTypeMismatch_Rejected(t *testing.T) {
	env := setupBusinessEnv(t)
	ctx := context.Background()

	cust := &model.Customer{FullName: "X", Phone: "0833"}
	require.NoError(t, env.CustStore.Create(ctx, cust))
	// Bandwidth profile pppoe.
	bp := &model.BandwidthProfile{
		DeviceID: env.Device.ID, ServiceType: "pppoe",
		Name: "X", MikrotikProfileName: "x-ppp", Active: true,
	}
	require.NoError(t, env.BWStore.Create(ctx, bp))

	// Subscription requesting hotspot → mismatch.
	w := httpJSON(env.HTTP, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"customer_id":          cust.ID,
		"device_id":            env.Device.ID,
		"bandwidth_profile_id": bp.ID,
		"service_type":         "hotspot",
		"mikrotik_username":    "x",
		"mikrotik_password":    "x",
	})
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "service_type mismatch")

	// Verifikasi: tidak ada record di DB.
	subs, _ := env.SubStore.List(ctx, store.SubscriptionListFilter{})
	assert.Empty(t, subs, "validation gagal sebelum hit DB")
}

func TestIntegration_Subscription_DuplicateUsername_409(t *testing.T) {
	env := setupBusinessEnv(t)
	ctx := context.Background()

	cust := &model.Customer{FullName: "X", Phone: "0844"}
	require.NoError(t, env.CustStore.Create(ctx, cust))
	bp := &model.BandwidthProfile{
		DeviceID: env.Device.ID, ServiceType: "pppoe",
		Name: "X", MikrotikProfileName: "x-ppp", Active: true,
	}
	require.NoError(t, env.BWStore.Create(ctx, bp))

	// Mock SecretAdd berhasil.
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ppp/secret/add"),
		tcpmock.DoneReply("=ret=*1"))
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ppp/secret/print"),
		tcpmock.ReReply("=.id=*1", "=name=dup", "=service=pppoe", "=profile=x-ppp", "=disabled=false"),
		tcpmock.DoneReply(),
	)
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ppp/secret/set"), tcpmock.DoneReply())

	body := map[string]any{
		"customer_id": cust.ID, "device_id": env.Device.ID, "bandwidth_profile_id": bp.ID,
		"service_type": "pppoe", "mikrotik_username": "dup", "mikrotik_password": "p",
	}

	// First create OK.
	w := httpJSON(env.HTTP, http.MethodPost, "/api/v1/subscriptions", body)
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())

	// Duplicate username → 409.
	w = httpJSON(env.HTTP, http.MethodPost, "/api/v1/subscriptions", body)
	assert.Equal(t, http.StatusConflict, w.Code)
}

// ── Soft-delete + phone re-register ─────────────────────────────────────

func TestIntegration_Customer_SoftDelete_AllowsPhoneReregister(t *testing.T) {
	env := setupBusinessEnv(t)
	ctx := context.Background()

	c1 := &model.Customer{FullName: "Pak A", Phone: "08555000"}
	require.NoError(t, env.CustStore.Create(ctx, c1))
	require.NoError(t, env.CustStore.Delete(ctx, c1.ID))

	// Phone yang sama harus bisa di-register lagi (partial unique index
	// WHERE deleted_at IS NULL).
	c2 := &model.Customer{FullName: "Pak B", Phone: "08555000"}
	err := env.CustStore.Create(ctx, c2)
	assert.NoError(t, err, "phone customer soft-deleted boleh re-register")
}

// ── BandwidthProfile in-use guard ───────────────────────────────────────

func TestIntegration_BandwidthProfile_DeleteWhileInUse_409(t *testing.T) {
	env := setupBusinessEnv(t)
	ctx := context.Background()

	cust := &model.Customer{FullName: "X", Phone: "0866"}
	require.NoError(t, env.CustStore.Create(ctx, cust))
	bp := &model.BandwidthProfile{
		DeviceID: env.Device.ID, ServiceType: "pppoe",
		Name: "X", MikrotikProfileName: "x-ppp", Active: true,
	}
	require.NoError(t, env.BWStore.Create(ctx, bp))
	// Insert subscription langsung via store (skip MikroTik propagate).
	sub := &model.Subscription{
		CustomerID: cust.ID, DeviceID: env.Device.ID,
		BandwidthProfileID: bp.ID, ServiceType: "pppoe",
		MikrotikUsername: "u1", MikrotikPassword: "p1",
	}
	require.NoError(t, env.SubStore.Create(ctx, sub))

	// Mock untuk DELETE bandwidth profile (kalau lolos sampai propagate).
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ppp/profile/print"),
		tcpmock.ReReply("=.id=*1", "=name=x-ppp"),
		tcpmock.DoneReply(),
	)
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ppp/profile/remove"), tcpmock.DoneReply())

	w := httpJSON(env.HTTP, http.MethodDelete,
		fmt.Sprintf("/api/v1/devices/%d/bandwidth-profiles/%d", env.Device.ID, bp.ID), nil)
	assert.Equal(t, http.StatusConflict, w.Code,
		"FK RESTRICT harus mencegah delete bandwidth_profile yang masih dipakai subscription")
	assert.Contains(t, w.Body.String(), "CONFLICT")
}

// ── Comment-based sync discriminator ────────────────────────────────────

// TestIntegration_BandwidthProfile_Sync_CommentDiscriminator verifikasi
// bahwa Sync handler melewati profile dengan comment "rosmon:vc" dan
// mengimpor profile unmanaged + "rosmon:bw" sebagai bandwidth_profile.
func TestIntegration_BandwidthProfile_Sync_CommentDiscriminator(t *testing.T) {
	env := setupBusinessEnv(t)

	// PPP: 1 profile normal (tidak ada comment).
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ppp/profile/print"),
		tcpmock.ReReply("=.id=*1", "=name=ppp-default", "=rate-limit="),
		tcpmock.DoneReply(),
	)
	// Hotspot: 3 profile — 1 unmanaged, 1 rosmon:bw, 1 rosmon:vc.
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/profile/print"),
		tcpmock.ReReply("=.id=*A", "=name=hs-unmanaged", "=rate-limit=2M/2M", "=address-pool=pool1", "=shared-users=1"),
		tcpmock.ReReply("=.id=*B", "=name=hs-bw", "=rate-limit=5M/5M", "=address-pool=pool2", "=shared-users=2", "=comment=rosmon:bw | Paket Rumah"),
		tcpmock.ReReply("=.id=*C", "=name=hs-vc", "=rate-limit=1M/1M", "=address-pool=hs-pool", "=shared-users=3", "=comment=rosmon:vc | 1day"),
		tcpmock.DoneReply(),
	)
	// Best-effort claim: ProfileSet dikirim untuk profile tanpa tag (hs-unmanaged).
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/profile/print"), tcpmock.DoneReply())
	env.MockSrv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/profile/set"), tcpmock.DoneReply())

	w := httpJSON(env.HTTP, http.MethodPost,
		fmt.Sprintf("/api/v1/devices/%d/bandwidth-profiles/sync", env.Device.ID), nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var resp struct {
		Data struct {
			Synced  []string `json:"synced"`
			Created []string `json:"created"`
			Orphan  []string `json:"orphan"`
			Skipped []string `json:"skipped"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))

	// pppoe/ppp-default, hotspot/hs-unmanaged, hotspot/hs-bw → Created.
	assert.ElementsMatch(t,
		[]string{"pppoe/ppp-default", "hotspot/hs-unmanaged", "hotspot/hs-bw"},
		resp.Data.Created, "unmanaged + bw-tagged should be imported")

	// hotspot/hs-vc → Skipped.
	require.Len(t, resp.Data.Skipped, 1)
	assert.Contains(t, resp.Data.Skipped[0], "hs-vc")
	assert.Contains(t, resp.Data.Skipped[0], "voucher")

	assert.Empty(t, resp.Data.Synced)
	assert.Empty(t, resp.Data.Orphan)

	// DB tidak memiliki hs-vc.
	rows, err := env.BWStore.ListByDevice(context.Background(), env.Device.ID, store.BandwidthProfileListFilter{})
	require.NoError(t, err)
	names := make([]string, len(rows))
	for i, r := range rows {
		names[i] = r.ServiceType + "/" + r.MikrotikProfileName
	}
	assert.Contains(t, names, "hotspot/hs-unmanaged")
	assert.Contains(t, names, "hotspot/hs-bw")
	assert.NotContains(t, names, "hotspot/hs-vc", "voucher profile must not be imported as bandwidth")
}

// TestIntegration_InjectOnLogin_Guard_RefusesBWProfile verifikasi bahwa
// InjectOnLoginScript menolak menulis script ke profile yang sudah diklaim
// oleh bandwidth_profiles (comment "rosmon:bw").
func TestIntegration_InjectOnLogin_Guard_RefusesBWProfile(t *testing.T) {
	cs, srv := testutil.NewTestClientSet(t)

	// ProfileByName lookup — kembalikan profile dengan comment rosmon:bw.
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/profile/print"),
		tcpmock.ReReply("=.id=*1", "=name=paket-rumah", "=rate-limit=10M/10M", "=comment=rosmon:bw | Paket Rumah 10M"),
		tcpmock.DoneReply(),
	)

	err := workflows.InjectOnLoginScript(
		context.Background(),
		cs.WF,
		"paket-rumah",
		workflows.OnLoginConfig{ExpiryMode: "rem", Validity: "30d", Price: 50000},
		1,
		"",
	)

	require.Error(t, err, "InjectOnLoginScript harus return error untuk profile rosmon:bw")
	assert.Contains(t, err.Error(), "owned by bandwidth_profile",
		"error message harus menjelaskan alasan penolakan")
}

// quickStrconv supaya golangci-lint puas (unused import check).
var _ = strconv.Itoa
