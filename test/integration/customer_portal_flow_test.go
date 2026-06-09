//go:build dbtest

package integration

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/api/middleware"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/service/auth"
	"github.com/quiqxiq/rosmon/service/billing"
	"github.com/quiqxiq/rosmon/service/portal"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestIntegration_CustomerPortal_FullFlow menguji alur lengkap Fase 3:
// admin set password → customer login → lihat invoice (kode unik) →
// petugas settle-by-code → invoice paid + subscription dipulihkan (outbox flag).
func TestIntegration_CustomerPortal_FullFlow(t *testing.T) {
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
	payStore := store.NewPaymentStore(db)

	log := logrus.New()
	log.SetLevel(logrus.WarnLevel)

	signer := auth.NewSigner("0123456789abcdef0123456789abcdef", 0, 0)
	hasher := auth.NewHasher(4)
	portalAuth := portal.New(portal.Deps{Customers: custStore, Hasher: hasher, Signer: signer})
	billingSvc := billing.New(billing.Deps{Invoices: invStore, Sequences: seqStore, PPP: pppStore, Hotspot: hsStore})

	// ── Seed: device + profil + customer + subscription (isolir) + invoice ──
	_, _, dev := testutil.NewTestDevMgr(t)
	require.NoError(t, devStore.Create(ctx, &dev))
	pp := &model.PPPProfile{DeviceID: dev.ID, Name: "ppp-home", PriceMonthly: 250000, Active: true}
	require.NoError(t, pppStore.Create(ctx, pp))

	cust := &model.Customer{FullName: "Pak Budi", Phone: "081299900011", Status: "aktif"}
	require.NoError(t, custStore.Create(ctx, cust))

	sub := &model.Subscription{
		CustomerID: cust.ID, DeviceID: dev.ID, ServiceType: "pppoe", PPPProfileID: &pp.ID,
		MikrotikUsername: "budi-001", MikrotikPassword: "secret", Status: "isolir", SyncStatus: "synced",
	}
	require.NoError(t, subStore.Create(ctx, sub))

	periodStart := time.Now().Truncate(24 * time.Hour)
	inv, err := billingSvc.GenerateForSubscription(ctx, *sub, periodStart, 7)
	require.NoError(t, err)
	require.NotEmpty(t, inv.PaymentCode, "invoice harus punya payment_code")

	// ── HTTP engine: customer portal + staff payments ──
	r := gin.New()
	apiPub := r.Group("/api")
	handler.NewCustomerAuth(portalAuth, signer).RegisterPublic(apiPub)

	apiCust := r.Group("/api")
	apiCust.Use(middleware.RequireCustomerAuth(signer))
	handler.NewCustomerPortal(portalAuth, custStore, subStore, invStore, payStore).Register(apiCust)

	staff := r.Group("/api/v1")
	handler.NewPayments(payStore, invStore, subStore, custStore, nil, nil, nil, log).Register(staff)

	// 1. Admin onboard: set portal password.
	require.NoError(t, portalAuth.SetPassword(ctx, cust.ID, "rahasia123"))

	// 2. Customer login.
	w := httpJSON(r, http.MethodPost, "/api/customer/login", map[string]any{
		"phone": "081299900011", "password": "rahasia123",
	})
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	var login struct {
		AccessToken string `json:"access_token"`
	}
	decodeData(t, w, &login)
	require.NotEmpty(t, login.AccessToken)

	// 3. Customer lihat invoice (kode unik tampil).
	wInv := httpAuth(r, http.MethodGet, "/api/customer/invoices", login.AccessToken, nil)
	require.Equal(t, http.StatusOK, wInv.Code, "body: %s", wInv.Body.String())
	var invoices []struct {
		ID          uint   `json:"id"`
		Status      string `json:"status"`
		PaymentCode string `json:"payment_code"`
		QRContent   string `json:"qr_content"`
	}
	decodeData(t, wInv, &invoices)
	require.Len(t, invoices, 1)
	assert.Equal(t, "issued", invoices[0].Status)
	assert.Equal(t, inv.PaymentCode, invoices[0].PaymentCode)
	assert.Equal(t, "rosmon-pay:"+inv.PaymentCode, invoices[0].QRContent)

	// 4. Petugas settle-by-code.
	wPay := httpJSON(r, http.MethodPost, "/api/v1/payments/collect", map[string]any{"code": inv.PaymentCode})
	require.Equal(t, http.StatusCreated, wPay.Code, "body: %s", wPay.Body.String())

	// 5. Invoice lunas.
	got, err := invStore.GetByID(ctx, inv.ID)
	require.NoError(t, err)
	assert.Equal(t, "paid", got.Status)
	require.NotNil(t, got.PaidAt)

	// 6. Payment tercatat confirmed cash.
	pays, err := payStore.List(ctx, store.PaymentListFilter{InvoiceID: inv.ID})
	require.NoError(t, err)
	require.Len(t, pays, 1)
	assert.Equal(t, "confirmed", pays[0].Status)
	assert.Equal(t, "cash", pays[0].Method)
	assert.EqualValues(t, 250000, pays[0].Amount)

	// 7. Subscription dipulihkan via outbox flag.
	gotSub, err := subStore.Get(ctx, sub.ID)
	require.NoError(t, err)
	assert.Equal(t, "active", gotSub.Status)
	assert.Equal(t, "pending_profile_change", gotSub.SyncStatus)

	// 8. Double-scan → 409 (idempotent).
	wDup := httpJSON(r, http.MethodPost, "/api/v1/payments/collect", map[string]any{"code": inv.PaymentCode})
	assert.Equal(t, http.StatusConflict, wDup.Code)
}
