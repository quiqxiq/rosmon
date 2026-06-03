//go:build dbtest

package integration

import (
	"context"
	"fmt"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type subEnv struct {
	HTTP     http.Handler
	Mock     *tcpmock.Server
	Device   model.MikrotikDevice
	SubStore store.SubscriptionStore
	Cust     store.CustomerStore
	PPP      store.PPPProfileStore
}

func setupSubEnv(t *testing.T) subEnv {
	t.Helper()
	gin.SetMode(gin.TestMode)
	require.NoError(t, store.SetDeviceCryptoKey(make([]byte, 32)))

	db := testutil.NewPostgres(t)
	devStore := store.NewDeviceStore(db)
	custStore := store.NewCustomerStore(db)
	pppStore := store.NewPPPProfileStore(db)
	hsStore := store.NewHotspotProfileStore(db)
	subStore := store.NewSubscriptionStore(db)
	settingStore := store.NewSettingStore(db)

	mgr, srv, dev := testutil.NewTestDevMgr(t)
	require.NoError(t, devStore.Create(context.Background(), &dev))

	log := logrus.New()
	log.SetLevel(logrus.WarnLevel)

	r := gin.New()
	g := r.Group("/api/v1")
	ch := handler.NewCustomers(custStore)
	ch.Register(g)
	ch.RegisterMutate(g) // DELETE /customers/:id (no auth guard in test mode)
	handler.NewSubscriptions(subStore, custStore, pppStore, hsStore, settingStore, mgr, log).Register(g)

	return subEnv{HTTP: r, Mock: srv, Device: dev, SubStore: subStore, Cust: custStore, PPP: pppStore}
}

// ── Customer lifecycle (DB only) ────────────────────────────────────────────

func TestIntegration_Customer_FullLifecycle(t *testing.T) {
	env := setupSubEnv(t)

	w := httpJSON(env.HTTP, http.MethodPost, "/api/v1/customers", map[string]any{
		"full_name": "Pak Budi", "phone": "0811000111", "address": "Jl. Mawar 1", "area": "RT01",
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	var created struct {
		ID uint `json:"id"`
	}
	decodeData(t, w, &created)
	require.NotZero(t, created.ID)

	w = httpJSON(env.HTTP, http.MethodGet, fmt.Sprintf("/api/v1/customers/%d", created.ID), nil)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"status":"aktif"`)

	// Duplicate phone → 409.
	w = httpJSON(env.HTTP, http.MethodPost, "/api/v1/customers", map[string]any{"full_name": "Lain", "phone": "0811000111"})
	assert.Equal(t, http.StatusConflict, w.Code)

	// Delete → 204, lalu GET 404.
	w = httpJSON(env.HTTP, http.MethodDelete, fmt.Sprintf("/api/v1/customers/%d", created.ID), nil)
	require.Equal(t, http.StatusNoContent, w.Code)
	w = httpJSON(env.HTTP, http.MethodGet, fmt.Sprintf("/api/v1/customers/%d", created.ID), nil)
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestIntegration_Customer_SoftDelete_AllowsPhoneReregister(t *testing.T) {
	env := setupSubEnv(t)
	ctx := context.Background()
	c1 := &model.Customer{FullName: "Pak A", Phone: "08555000"}
	require.NoError(t, env.Cust.Create(ctx, c1))
	require.NoError(t, env.Cust.Delete(ctx, c1.ID))
	c2 := &model.Customer{FullName: "Pak B", Phone: "08555000"}
	assert.NoError(t, env.Cust.Create(ctx, c2), "phone customer soft-deleted boleh re-register")
}

// ── Subscription lifecycle (current API + tcpmock router) ───────────────────

func TestIntegration_Subscription_CreateProvisionAndStatus(t *testing.T) {
	env := setupSubEnv(t)
	ctx := context.Background()

	cust := &model.Customer{FullName: "Pak Joko", Phone: "08222333", Status: "aktif"}
	require.NoError(t, env.Cust.Create(ctx, cust))
	pp := &model.PPPProfile{DeviceID: env.Device.ID, Name: "ppp-home", RateLimit: "20M/20M", PriceMonthly: 250000, Active: true}
	require.NoError(t, env.PPP.Create(ctx, pp))

	// Mock router untuk lifecycle PPPoE secret.
	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/add"), tcpmock.DoneReply("=ret=*S1"))
	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/print"),
		tcpmock.ReReply("=.id=*S1", "=name=joko-001", "=service=pppoe", "=profile=ppp-home", "=disabled=false"),
		tcpmock.DoneReply(),
	)
	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/set"), tcpmock.DoneReply())
	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/remove"), tcpmock.DoneReply())

	// CREATE → provision sukses → auto-active.
	w := httpJSON(env.HTTP, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"customer_id": cust.ID, "device_id": env.Device.ID, "ppp_profile_id": pp.ID,
		"service_type": "pppoe", "mikrotik_username": "joko-001", "mikrotik_password": "rahasia",
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"status":"active"`)

	var createResp struct {
		Subscription struct {
			ID uint `json:"id"`
		} `json:"subscription"`
	}
	decodeData(t, w, &createResp)
	subID := createResp.Subscription.ID
	require.NotZero(t, subID)

	env.Mock.AssertReceived(t, tcpmock.MatchAll(
		tcpmock.MatchCommand("/ppp/secret/add"),
		tcpmock.MatchHas("name", "joko-001"),
		tcpmock.MatchHas("profile", "ppp-home"),
	), "secret add dengan field benar")

	// Password ter-encrypt at rest.
	subDB, err := env.SubStore.Get(ctx, subID)
	require.NoError(t, err)
	assert.Equal(t, "rahasia", subDB.MikrotikPassword, "store.Get harus decrypt")

	// PATCH → isolir.
	w = httpJSON(env.HTTP, http.MethodPatch, fmt.Sprintf("/api/v1/subscriptions/%d/status", subID), map[string]any{"status": "isolir"})
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"status":"isolir"`)

	// PATCH → terminated → SecretRemove.
	w = httpJSON(env.HTTP, http.MethodPatch, fmt.Sprintf("/api/v1/subscriptions/%d/status", subID), map[string]any{"status": "terminated"})
	require.Equal(t, http.StatusOK, w.Code)
	env.Mock.AssertReceived(t, tcpmock.MatchCommand("/ppp/secret/remove"), "terminate → SecretRemove")

	subDB, err = env.SubStore.Get(ctx, subID)
	require.NoError(t, err)
	assert.Equal(t, "terminated", subDB.Status)
}

func TestIntegration_Subscription_DuplicateUsername_409(t *testing.T) {
	env := setupSubEnv(t)
	ctx := context.Background()

	cust := &model.Customer{FullName: "X", Phone: "0844"}
	require.NoError(t, env.Cust.Create(ctx, cust))
	pp := &model.PPPProfile{DeviceID: env.Device.ID, Name: "x-ppp", Active: true}
	require.NoError(t, env.PPP.Create(ctx, pp))

	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/add"), tcpmock.DoneReply("=ret=*1"))
	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/print"),
		tcpmock.ReReply("=.id=*1", "=name=dup", "=service=pppoe", "=profile=x-ppp", "=disabled=false"),
		tcpmock.DoneReply(),
	)
	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/set"), tcpmock.DoneReply())

	body := map[string]any{
		"customer_id": cust.ID, "device_id": env.Device.ID, "ppp_profile_id": pp.ID,
		"service_type": "pppoe", "mikrotik_username": "dup", "mikrotik_password": "p",
	}
	w := httpJSON(env.HTTP, http.MethodPost, "/api/v1/subscriptions", body)
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	w = httpJSON(env.HTTP, http.MethodPost, "/api/v1/subscriptions", body)
	assert.Equal(t, http.StatusConflict, w.Code)
}
