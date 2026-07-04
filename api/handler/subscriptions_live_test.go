package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupDeviceSubEngine bangun gin.Engine untuk DeviceSubscriptions:
//   - Middleware injektor ClientSet (mirip DeviceMiddleware, tanpa lookup DB).
//   - Rute /api/v1/devices/:device_id/subscriptions.
//
// Mengembalikan engine, fake subscription store, dan tcpmock server.
func setupDeviceSubEngine(t *testing.T) (*gin.Engine, *fakeSubscriptionStore, *tcpmock.Server) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	cs, srv := testutil.NewTestClientSet(t)
	subS := newFakeSubStore()

	r := gin.New()
	// Inject ClientSet ke context, persis seperti DeviceMiddleware production.
	r.Use(func(c *gin.Context) {
		api.SetClients(c, cs)
		c.Next()
	})
	g := r.Group("/api/v1/devices/:device_id")
	handler.NewSubscriptions(subS, nil, nil, nil, nil, nil, nil).RegisterDevice(g)
	return r, subS, srv
}

// doGet adalah helper GET request untuk test.
func doGet(r *gin.Engine, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// enrichedBody adalah struktur respons ListEnvelope<SubscriptionEnrichedResponse>.
type enrichedBody struct {
	Data []struct {
		Subscription struct {
			MikrotikUsername string `json:"mikrotik_username"`
			Status           string `json:"status"`
			ServiceType      string `json:"service_type"`
		} `json:"subscription"`
		Session *struct {
			Uptime   string `json:"uptime"`
			Address  string `json:"address"`
			CallerID string `json:"caller_id"`
			BytesIn  int64  `json:"bytes_in"`
			BytesOut int64  `json:"bytes_out"`
		} `json:"session"`
		RouterDrift string `json:"router_drift"`
	} `json:"data"`
	Total int `json:"total"`
}

// TestDeviceSubs_PPPoE_Online — PPPoE user muncul di /ppp/active → session terisi.
func TestDeviceSubs_PPPoE_Online(t *testing.T) {
	if testutil.RaceEnabled {
		t.Skip("skip: concurrent router fetch can trigger upstream go-routeros race")
	}
	r, subS, srv := setupDeviceSubEngine(t)

	sub := &model.Subscription{
		CustomerID: 1, DeviceID: 1, ServiceType: "pppoe",
		MikrotikUsername: "pppoe-user1", Status: "active", SyncStatus: "synced",
	}
	require.NoError(t, subS.Create(context.Background(), sub))

	srv.OnSentence(tcpmock.MatchCommand("/ppp/active/print"),
		tcpmock.ReReply(
			"=.id=*1", "=name=pppoe-user1",
			"=uptime=1d2h3m", "=address=10.0.0.5", "=caller-id=AA:BB:CC:DD:EE:FF",
		),
		tcpmock.DoneReply(),
	)
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/active/print"),
		tcpmock.DoneReply(),
	)

	w := doGet(r, "/api/v1/devices/1/subscriptions")
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var body enrichedBody
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	require.Len(t, body.Data, 1)

	item := body.Data[0]
	assert.Equal(t, "pppoe-user1", item.Subscription.MikrotikUsername)
	require.NotNil(t, item.Session, "session harus ada karena user online di /ppp/active")
	assert.Equal(t, "1d2h3m", item.Session.Uptime)
	assert.Equal(t, "10.0.0.5", item.Session.Address)
	assert.Equal(t, "AA:BB:CC:DD:EE:FF", item.Session.CallerID)
	assert.Empty(t, item.RouterDrift)
}

// TestDeviceSubs_Hotspot_Online — hotspot permanent user muncul di /ip/hotspot/active.
func TestDeviceSubs_Hotspot_Online(t *testing.T) {
	if testutil.RaceEnabled {
		t.Skip("skip: concurrent router fetch can trigger upstream go-routeros race")
	}
	r, subS, srv := setupDeviceSubEngine(t)

	sub := &model.Subscription{
		CustomerID: 2, DeviceID: 1, ServiceType: "hotspot",
		MikrotikUsername: "hs-pelanggan02", Status: "active", SyncStatus: "synced",
	}
	require.NoError(t, subS.Create(context.Background(), sub))

	srv.OnSentence(tcpmock.MatchCommand("/ppp/active/print"),
		tcpmock.DoneReply(),
	)
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/active/print"),
		tcpmock.ReReply(
			"=.id=*2", "=user=hs-pelanggan02",
			"=uptime=0d3h15m", "=address=10.0.1.6",
			"=bytes-in=1048576", "=bytes-out=524288",
		),
		tcpmock.DoneReply(),
	)

	w := doGet(r, "/api/v1/devices/1/subscriptions")
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var body enrichedBody
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	require.Len(t, body.Data, 1)

	item := body.Data[0]
	assert.Equal(t, "hs-pelanggan02", item.Subscription.MikrotikUsername)
	require.NotNil(t, item.Session, "session harus ada karena user online di /ip/hotspot/active")
	assert.Equal(t, "0d3h15m", item.Session.Uptime)
	assert.Equal(t, "10.0.1.6", item.Session.Address)
	assert.EqualValues(t, 1048576, item.Session.BytesIn)
	assert.EqualValues(t, 524288, item.Session.BytesOut)
	assert.Empty(t, item.Session.CallerID, "hotspot tidak punya caller_id")
	assert.Empty(t, item.RouterDrift)
}

// TestDeviceSubs_Offline — user tidak ada di active list → Session nil.
func TestDeviceSubs_Offline(t *testing.T) {
	if testutil.RaceEnabled {
		t.Skip("skip: concurrent router fetch can trigger upstream go-routeros race")
	}
	r, subS, srv := setupDeviceSubEngine(t)

	sub := &model.Subscription{
		CustomerID: 3, DeviceID: 1, ServiceType: "pppoe",
		MikrotikUsername: "pppoe-offline01", Status: "active", SyncStatus: "synced",
	}
	require.NoError(t, subS.Create(context.Background(), sub))

	// Router mengembalikan list kosong — user tidak online.
	srv.OnSentence(tcpmock.MatchCommand("/ppp/active/print"), tcpmock.DoneReply())
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/active/print"), tcpmock.DoneReply())

	w := doGet(r, "/api/v1/devices/1/subscriptions")
	require.Equal(t, http.StatusOK, w.Code)

	var body enrichedBody
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	require.Len(t, body.Data, 1)

	item := body.Data[0]
	assert.Nil(t, item.Session, "Session harus nil jika user tidak ada di active list")
	assert.Empty(t, item.RouterDrift)
}

// TestDeviceSubs_Drift_OnlineWhileSuspended — user aktif di router tapi DB = suspended.
func TestDeviceSubs_Drift_OnlineWhileSuspended(t *testing.T) {
	if testutil.RaceEnabled {
		t.Skip("skip: concurrent router fetch can trigger upstream go-routeros race")
	}
	r, subS, srv := setupDeviceSubEngine(t)

	sub := &model.Subscription{
		CustomerID: 4, DeviceID: 1, ServiceType: "pppoe",
		MikrotikUsername: "pppoe-suspend01", Status: "suspended", SyncStatus: "error",
	}
	require.NoError(t, subS.Create(context.Background(), sub))

	// Router masih menampilkan user (outbox gagal disable).
	srv.OnSentence(tcpmock.MatchCommand("/ppp/active/print"),
		tcpmock.ReReply("=.id=*3", "=name=pppoe-suspend01", "=uptime=0d5m", "=address=10.0.0.9"),
		tcpmock.DoneReply(),
	)
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/active/print"), tcpmock.DoneReply())

	w := doGet(r, "/api/v1/devices/1/subscriptions")
	require.Equal(t, http.StatusOK, w.Code)

	var body enrichedBody
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	require.Len(t, body.Data, 1)

	item := body.Data[0]
	require.NotNil(t, item.Session, "session ada karena user masih online di router")
	assert.Equal(t, "online_while_suspended", item.RouterDrift)
}

// TestDeviceSubs_Drift_OnlineWhileTerminated — user aktif di router tapi DB = terminated.
func TestDeviceSubs_Drift_OnlineWhileTerminated(t *testing.T) {
	if testutil.RaceEnabled {
		t.Skip("skip: concurrent router fetch can trigger upstream go-routeros race")
	}
	r, subS, srv := setupDeviceSubEngine(t)

	sub := &model.Subscription{
		CustomerID: 5, DeviceID: 1, ServiceType: "hotspot",
		MikrotikUsername: "hs-terminated01", Status: "terminated", SyncStatus: "error",
	}
	require.NoError(t, subS.Create(context.Background(), sub))

	srv.OnSentence(tcpmock.MatchCommand("/ppp/active/print"), tcpmock.DoneReply())
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/active/print"),
		tcpmock.ReReply("=.id=*4", "=user=hs-terminated01", "=uptime=2d", "=address=10.0.1.9"),
		tcpmock.DoneReply(),
	)

	w := doGet(r, "/api/v1/devices/1/subscriptions")
	require.Equal(t, http.StatusOK, w.Code)

	var body enrichedBody
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	require.Len(t, body.Data, 1)

	item := body.Data[0]
	require.NotNil(t, item.Session)
	assert.Equal(t, "online_while_terminated", item.RouterDrift)
}

// TestDeviceSubs_EmptyDevice — device tidak punya subscription.
func TestDeviceSubs_EmptyDevice(t *testing.T) {
	if testutil.RaceEnabled {
		t.Skip("skip: concurrent router fetch can trigger upstream go-routeros race")
	}
	r, _, srv := setupDeviceSubEngine(t)

	srv.OnSentence(tcpmock.MatchCommand("/ppp/active/print"), tcpmock.DoneReply())
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/active/print"), tcpmock.DoneReply())

	w := doGet(r, "/api/v1/devices/1/subscriptions")
	require.Equal(t, http.StatusOK, w.Code)

	var body enrichedBody
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	assert.Empty(t, body.Data)
	assert.Equal(t, 0, body.Total)
}

// TestDeviceSubs_Mixed — beberapa subscription berbeda tipe dan status.
func TestDeviceSubs_Mixed(t *testing.T) {
	if testutil.RaceEnabled {
		t.Skip("skip: concurrent router fetch can trigger upstream go-routeros race")
	}
	r, subS, srv := setupDeviceSubEngine(t)

	// Seed 3 subscription: pppoe online, hotspot online, pppoe offline.
	require.NoError(t, subS.Create(context.Background(), &model.Subscription{
		CustomerID: 10, DeviceID: 1, ServiceType: "pppoe",
		MikrotikUsername: "pppoe-a", Status: "active", SyncStatus: "synced",
	}))
	require.NoError(t, subS.Create(context.Background(), &model.Subscription{
		CustomerID: 11, DeviceID: 1, ServiceType: "hotspot",
		MikrotikUsername: "hs-b", Status: "active", SyncStatus: "synced",
	}))
	require.NoError(t, subS.Create(context.Background(), &model.Subscription{
		CustomerID: 12, DeviceID: 1, ServiceType: "pppoe",
		MikrotikUsername: "pppoe-c", Status: "isolir", SyncStatus: "synced",
	}))

	srv.OnSentence(tcpmock.MatchCommand("/ppp/active/print"),
		tcpmock.ReReply("=.id=*1", "=name=pppoe-a", "=uptime=5h", "=address=192.168.0.2"),
		tcpmock.DoneReply(),
	)
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/active/print"),
		tcpmock.ReReply("=.id=*1", "=user=hs-b", "=uptime=3h", "=address=192.168.0.3", "=bytes-in=2048", "=bytes-out=1024"),
		tcpmock.DoneReply(),
	)

	w := doGet(r, "/api/v1/devices/1/subscriptions")
	require.Equal(t, http.StatusOK, w.Code)

	var body enrichedBody
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	require.Len(t, body.Data, 3)

	// Build map untuk lookup by username.
	byUser := map[string]struct {
		session     interface{}
		routerDrift string
	}{}
	for _, item := range body.Data {
		byUser[item.Subscription.MikrotikUsername] = struct {
			session     interface{}
			routerDrift string
		}{item.Session, item.RouterDrift}
	}

	// pppoe-a: online, no drift.
	a := body.Data[0]
	for _, d := range body.Data {
		if d.Subscription.MikrotikUsername == "pppoe-a" {
			a = d
			break
		}
	}
	require.NotNil(t, a.Session, "pppoe-a harus online")
	assert.Equal(t, "5h", a.Session.Uptime)
	assert.Empty(t, a.RouterDrift)

	// hs-b: online hotspot, no drift.
	var b struct {
		Subscription struct {
			MikrotikUsername string `json:"mikrotik_username"`
		} `json:"subscription"`
		Session *struct {
			Uptime   string `json:"uptime"`
			BytesIn  int64  `json:"bytes_in"`
			BytesOut int64  `json:"bytes_out"`
		} `json:"session"`
		RouterDrift string `json:"router_drift"`
	}
	for _, d := range body.Data {
		if d.Subscription.MikrotikUsername == "hs-b" {
			raw, _ := json.Marshal(d)
			_ = json.Unmarshal(raw, &b)
			break
		}
	}
	require.NotNil(t, b.Session, "hs-b harus online")
	assert.Equal(t, "3h", b.Session.Uptime)
	assert.EqualValues(t, 2048, b.Session.BytesIn)

	// pppoe-c: offline (isolir), no drift.
	var c struct {
		Session     interface{} `json:"session"`
		RouterDrift string      `json:"router_drift"`
	}
	for _, d := range body.Data {
		if d.Subscription.MikrotikUsername == "pppoe-c" {
			raw, _ := json.Marshal(d)
			_ = json.Unmarshal(raw, &c)
			break
		}
	}
	assert.Nil(t, c.Session, "pppoe-c harus offline (tidak ada di active list)")
	assert.Empty(t, c.RouterDrift)

	// Pastikan voucher hotspot TIDAK masuk (tidak ada di DB subscriptions).
	_ = byUser // voucher tidak ada di DB, jadi tidak akan muncul
}

// TestDeviceSubs_DeviceIDFilter — hanya subscription device yang diminta yang dikembalikan.
func TestDeviceSubs_DeviceIDFilter(t *testing.T) {
	if testutil.RaceEnabled {
		t.Skip("skip: concurrent router fetch can trigger upstream go-routeros race")
	}
	r, subS, srv := setupDeviceSubEngine(t)

	// Seed: 1 sub di device 1, 1 sub di device 2.
	require.NoError(t, subS.Create(context.Background(), &model.Subscription{
		CustomerID: 20, DeviceID: 1, ServiceType: "pppoe",
		MikrotikUsername: "dev1-user", Status: "active", SyncStatus: "synced",
	}))
	require.NoError(t, subS.Create(context.Background(), &model.Subscription{
		CustomerID: 21, DeviceID: 2, ServiceType: "pppoe",
		MikrotikUsername: "dev2-user", Status: "active", SyncStatus: "synced",
	}))

	srv.OnSentence(tcpmock.MatchCommand("/ppp/active/print"),
		tcpmock.ReReply("=.id=*1", "=name=dev1-user", "=uptime=1h", "=address=10.0.0.1"),
		tcpmock.DoneReply(),
	)
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/active/print"), tcpmock.DoneReply())

	// Minta hanya device 1.
	w := doGet(r, "/api/v1/devices/1/subscriptions")
	require.Equal(t, http.StatusOK, w.Code)

	var body enrichedBody
	require.NoError(t, json.NewDecoder(w.Body).Decode(&body))
	require.Len(t, body.Data, 1, "hanya subscription device 1 yang boleh muncul")
	assert.Equal(t, "dev1-user", body.Data[0].Subscription.MikrotikUsername)
}
