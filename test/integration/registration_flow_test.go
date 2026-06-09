//go:build dbtest

package integration

import (
	"context"
	"net/http"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/service/billing"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestIntegration_Registration_FullFlow menguji alur lengkap:
// submit publik → approve (customer terbuat) → complete-install
// (subscription pending_create + invoice pertama). Provisioning router
// dilakukan outbox (di luar scope test ini), jadi tanpa tcpmock.
func TestIntegration_Registration_FullFlow(t *testing.T) {
	gin.SetMode(gin.TestMode)
	require.NoError(t, store.SetDeviceCryptoKey(make([]byte, 32)))

	db := testutil.NewPostgres(t)
	ctx := context.Background()

	devStore := store.NewDeviceStore(db)
	custStore := store.NewCustomerStore(db)
	pppStore := store.NewPPPProfileStore(db)
	hsStore := store.NewHotspotProfileStore(db)
	subStore := store.NewSubscriptionStore(db)
	invStore := store.NewInvoiceStore(db)
	seqStore := store.NewSequenceStore(db)
	settingStore := store.NewSettingStore(db)
	regStore := store.NewRegistrationStore(db)

	// Device + PPP profile (FK + harga untuk invoice).
	_, _, dev := testutil.NewTestDevMgr(t)
	require.NoError(t, devStore.Create(ctx, &dev))
	pp := &model.PPPProfile{DeviceID: dev.ID, Name: "ppp-home", PriceMonthly: 250000, Active: true}
	require.NoError(t, pppStore.Create(ctx, pp))

	billingSvc := billing.New(billing.Deps{Invoices: invStore, Sequences: seqStore, PPP: pppStore, Hotspot: hsStore})
	log := logrus.New()
	log.SetLevel(logrus.WarnLevel)

	// Notification & Audit nil → fokus ke alur data (nil-safe).
	regHandler := handler.NewRegistrations(regStore, custStore, subStore, billingSvc, nil, settingStore, nil, log)
	r := gin.New()
	g := r.Group("/api/v1")
	regHandler.RegisterPublic(g)
	regHandler.RegisterStaff(g)

	// 1. Submit publik.
	w := httpJSON(r, http.MethodPost, "/api/v1/public/registrations", map[string]any{
		"full_name": "Pak Budi", "phone": "0811000222", "address": "Jl. Mawar 1", "area": "RT01",
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	var reg struct {
		ID     uint   `json:"id"`
		Status string `json:"status"`
	}
	decodeData(t, w, &reg)
	require.NotZero(t, reg.ID)
	assert.Equal(t, "pending", reg.Status)

	// 2. Approve → customer terbuat.
	w = httpJSON(r, http.MethodPost, "/api/v1/registrations/1/approve", map[string]any{})
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	cust, err := custStore.GetByPhone(ctx, "0811000222")
	require.NoError(t, err, "approve harus membuat customer")

	// 3. Complete-install → subscription + invoice pertama.
	w = httpJSON(r, http.MethodPost, "/api/v1/registrations/1/complete-install", map[string]any{
		"device_id":         dev.ID,
		"service_type":      "pppoe",
		"ppp_profile_id":    pp.ID,
		"mikrotik_username": "budi-001",
		"mikrotik_password": "rahasia",
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())

	// Subscription tersimpan: active + pending_create (menunggu outbox).
	subs, err := subStore.List(ctx, store.SubscriptionListFilter{CustomerID: cust.ID})
	require.NoError(t, err)
	require.Len(t, subs, 1)
	assert.Equal(t, "active", subs[0].Status)
	assert.Equal(t, "pending_create", subs[0].SyncStatus)
	assert.Equal(t, "budi-001", subs[0].MikrotikUsername)

	// Invoice pertama tergenerate.
	invs, err := invStore.List(ctx, store.InvoiceListFilter{SubscriptionID: subs[0].ID})
	require.NoError(t, err)
	require.Len(t, invs, 1)
	assert.Equal(t, int64(250000), invs[0].Amount)
	assert.Equal(t, "issued", invs[0].Status)

	// Registrasi ditandai installed.
	got, err := regStore.Get(ctx, reg.ID)
	require.NoError(t, err)
	require.NotNil(t, got.InstalledAt)
}
