//go:build dbtest

package integration

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/job"
	"github.com/quiqxiq/rosmon/service/billing"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// billingEnv menyatukan semua store dan HTTP handler untuk billing flow tests.
type billingEnv struct {
	HTTP        http.Handler
	Mock        *tcpmock.Server
	Device      model.MikrotikDevice
	CustStore   store.CustomerStore
	PPPStore    store.PPPProfileStore
	HSStore     store.HotspotProfileStore
	SubStore    store.SubscriptionStore
	InvStore    store.InvoiceStore
	TxStore     store.TransactionStore
	BillingSvc  *billing.Service
	BillingCron *job.BillingCronJob
}

func setupBillingEnv(t *testing.T) billingEnv {
	t.Helper()
	gin.SetMode(gin.TestMode)
	require.NoError(t, store.SetDeviceCryptoKey(make([]byte, 32)))

	db := testutil.NewPostgres(t)
	devStore := store.NewDeviceStore(db)
	custStore := store.NewCustomerStore(db)
	pppStore := store.NewPPPProfileStore(db)
	hsStore := store.NewHotspotProfileStore(db)
	subStore := store.NewSubscriptionStore(db)
	invStore := store.NewInvoiceStore(db)
	seqStore := store.NewSequenceStore(db)
	settStore := store.NewSettingStore(db)
	txStore := store.NewTransactionStore(db)

	mgr, srv, dev := testutil.NewTestDevMgr(t)
	require.NoError(t, devStore.Create(context.Background(), &dev))

	log := logrus.New()
	log.SetLevel(logrus.WarnLevel)

	billingSvc := billing.New(billing.Deps{
		Invoices:  invStore,
		Sequences: seqStore,
		PPP:       pppStore,
		Hotspot:   hsStore,
		NowFunc:   time.Now,
	})

	billingCron := job.NewBillingCronJob(subStore, custStore, settStore, billingSvc, nil, log)

	r := gin.New()
	g := r.Group("/api/v1")

	// Customers
	handler.NewCustomers(custStore).Register(g)

	// PPP + Hotspot profiles per-device (DeviceMiddleware dipakai implisit via devmgr)
	devG := g.Group("/devices/:device_id")
	handler.NewPPPProfiles(pppStore, mgr, log).Register(devG)
	handler.NewHotspotProfiles(hsStore, mgr, "", log).Register(devG)

	// Subscriptions
	handler.NewSubscriptions(subStore, custStore, pppStore, hsStore, settStore, mgr, log).Register(g)

	// Invoices
	invH := handler.NewInvoices(invStore, seqStore)
	invH.SubStore = subStore
	invH.Billing = billingSvc
	invH.Register(g)

	// Financial reports
	handler.NewReportFinancial(invStore, subStore).Register(g)

	// Laporan penjualan voucher per-device
	handler.NewReport(devStore, txStore).Register(g.Group("/devices/:device_id"))

	return billingEnv{
		HTTP: r, Mock: srv, Device: dev,
		CustStore: custStore, PPPStore: pppStore, HSStore: hsStore,
		SubStore: subStore, InvStore: invStore, TxStore: txStore,
		BillingSvc: billingSvc, BillingCron: billingCron,
	}
}

// ─── PPP Profile billing ───────────────────────────────────────────────────

func TestIntegration_Billing_PPPProfile_CreateAndList(t *testing.T) {
	env := setupBillingEnv(t)

	// CREATE — device offline (tcpmock tidak punya /ppp/profile/add handler)
	// → Create tetap 201, warning "device offline" karena propagateAdd gagal.
	w := httpJSON(env.HTTP, http.MethodPost,
		fmt.Sprintf("/api/v1/devices/%d/ppp-profiles", env.Device.ID),
		map[string]any{
			"name":          "Paket-20M",
			"rate_limit":    "20M/20M",
			"price_monthly": 250000,
			"description":   "Paket 20 Mbps",
			"active":        true,
		})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())

	var createResp struct {
		Profile struct {
			ID           uint   `json:"id"`
			Name         string `json:"name"`
			PriceMonthly int64  `json:"price_monthly"`
			Active       bool   `json:"active"`
		} `json:"profile"`
		Warning string `json:"warning,omitempty"`
	}
	decodeData(t, w, &createResp)
	require.NotZero(t, createResp.Profile.ID)
	assert.Equal(t, "Paket-20M", createResp.Profile.Name)
	assert.Equal(t, int64(250000), createResp.Profile.PriceMonthly)
	assert.True(t, createResp.Profile.Active)
	assert.NotEmpty(t, createResp.Warning, "harus ada warning device offline")

	// CREATE paket ke-2
	w = httpJSON(env.HTTP, http.MethodPost,
		fmt.Sprintf("/api/v1/devices/%d/ppp-profiles", env.Device.ID),
		map[string]any{
			"name": "Paket-50M", "rate_limit": "50M/50M",
			"price_monthly": 450000, "active": true,
		})
	require.Equal(t, http.StatusCreated, w.Code)

	// LIST — harus ada 2 profil
	w = httpJSON(env.HTTP, http.MethodGet,
		fmt.Sprintf("/api/v1/devices/%d/ppp-profiles", env.Device.ID), nil)
	require.Equal(t, http.StatusOK, w.Code)
	var listResp []struct {
		ID   uint   `json:"id"`
		Name string `json:"name"`
	}
	decodeData(t, w, &listResp)
	assert.Len(t, listResp, 2)

	// GET by ID
	profileID := createResp.Profile.ID
	w = httpJSON(env.HTTP, http.MethodGet,
		fmt.Sprintf("/api/v1/devices/%d/ppp-profiles/%d", env.Device.ID, profileID), nil)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"Paket-20M"`)

	// UPDATE — ubah harga profil
	w = httpJSON(env.HTTP, http.MethodPut,
		fmt.Sprintf("/api/v1/devices/%d/ppp-profiles/%d", env.Device.ID, profileID),
		map[string]any{"price_monthly": 275000})
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), "275000")
}

func TestIntegration_Billing_PPPProfile_DuplicateName_Conflict(t *testing.T) {
	env := setupBillingEnv(t)
	body := map[string]any{"name": "Duplikat", "price_monthly": 100000, "active": true}
	w := httpJSON(env.HTTP, http.MethodPost,
		fmt.Sprintf("/api/v1/devices/%d/ppp-profiles", env.Device.ID), body)
	require.Equal(t, http.StatusCreated, w.Code)
	// nama duplikat → 409
	w = httpJSON(env.HTTP, http.MethodPost,
		fmt.Sprintf("/api/v1/devices/%d/ppp-profiles", env.Device.ID), body)
	assert.Equal(t, http.StatusConflict, w.Code, "nama duplikat harus 409")
}

// ─── Hotspot Profile billing ───────────────────────────────────────────────

func TestIntegration_Billing_HotspotProfile_Permanent(t *testing.T) {
	env := setupBillingEnv(t)

	// CREATE role=permanent (langganan bulanan)
	w := httpJSON(env.HTTP, http.MethodPost,
		fmt.Sprintf("/api/v1/devices/%d/hotspot-profiles", env.Device.ID),
		map[string]any{
			"name":          "HS-Bulanan-5M",
			"role":          "permanent",
			"rate_limit":    "5M/5M",
			"price_monthly": 99000,
			"shared_users":  1,
			"active":        true,
		})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())

	var resp struct {
		Profile struct {
			ID           uint   `json:"id"`
			Role         string `json:"role"`
			PriceMonthly int64  `json:"price_monthly"`
		} `json:"profile"`
		Warning string `json:"warning,omitempty"`
	}
	decodeData(t, w, &resp)
	require.NotZero(t, resp.Profile.ID)
	assert.Equal(t, "permanent", resp.Profile.Role)
	assert.Equal(t, int64(99000), resp.Profile.PriceMonthly)
	assert.NotEmpty(t, resp.Warning, "device offline → warning")

	// GET by ID
	w = httpJSON(env.HTTP, http.MethodGet,
		fmt.Sprintf("/api/v1/devices/%d/hotspot-profiles/%d", env.Device.ID, resp.Profile.ID), nil)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"permanent"`)
}

func TestIntegration_Billing_HotspotProfile_Voucher(t *testing.T) {
	env := setupBillingEnv(t)

	// CREATE role=voucher (harga per-voucher, ada validity + expiry_mode)
	w := httpJSON(env.HTTP, http.MethodPost,
		fmt.Sprintf("/api/v1/devices/%d/hotspot-profiles", env.Device.ID),
		map[string]any{
			"name":         "Voucher-1Hari",
			"role":         "voucher",
			"rate_limit":   "2M/2M",
			"expiry_mode":  "rem",
			"validity":     "1d",
			"price":        5000,
			"sell_price":   7000,
			"shared_users": 1,
			"active":       true,
		})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())

	var resp struct {
		Profile struct {
			ID         uint   `json:"id"`
			Role       string `json:"role"`
			Price      int    `json:"price"`
			SellPrice  int    `json:"sell_price"`
			ExpiryMode string `json:"expiry_mode"`
		} `json:"profile"`
	}
	decodeData(t, w, &resp)
	require.NotZero(t, resp.Profile.ID)
	assert.Equal(t, "voucher", resp.Profile.Role)
	assert.Equal(t, 5000, resp.Profile.Price)
	assert.Equal(t, 7000, resp.Profile.SellPrice)
	assert.Equal(t, "rem", resp.Profile.ExpiryMode)

	// LIST filter by role=voucher
	w = httpJSON(env.HTTP, http.MethodGet,
		fmt.Sprintf("/api/v1/devices/%d/hotspot-profiles?role=voucher", env.Device.ID), nil)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "Voucher-1Hari")

	// LIST filter by role=permanent harus kosong
	w = httpJSON(env.HTTP, http.MethodGet,
		fmt.Sprintf("/api/v1/devices/%d/hotspot-profiles?role=permanent", env.Device.ID), nil)
	require.Equal(t, http.StatusOK, w.Code)
	assert.NotContains(t, w.Body.String(), "Voucher-1Hari")
}

// ─── Customer + Hotspot subscription ──────────────────────────────────────

func TestIntegration_Billing_Customer_HotspotSubscription(t *testing.T) {
	env := setupBillingEnv(t)
	ctx := context.Background()

	// Seed customer
	cust := &model.Customer{FullName: "Ibu Sari", Phone: "081200001111", Status: "aktif"}
	require.NoError(t, env.CustStore.Create(ctx, cust))

	// Seed hotspot profile permanent langsung via store
	hsProf := &model.HotspotProfile{
		DeviceID: env.Device.ID, Name: "HS-Perm-5M",
		Role: "permanent", RateLimit: "5M/5M", PriceMonthly: 99000,
		SharedUsers: 1, Active: true, ExpiryMode: "0",
	}
	_, err := env.HSStore.Upsert(ctx, hsProf)
	require.NoError(t, err)

	// Mock router untuk hotspot user lifecycle
	env.Mock.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/add"),
		tcpmock.DoneReply("=ret=*H1"))
	env.Mock.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/print"),
		tcpmock.ReReply("=.id=*H1", "=name=sari-hs01", "=profile=HS-Perm-5M", "=disabled=false"),
		tcpmock.DoneReply(),
	)
	env.Mock.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/set"), tcpmock.DoneReply())
	env.Mock.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/remove"), tcpmock.DoneReply())

	// CREATE subscription hotspot via API
	w := httpJSON(env.HTTP, http.MethodPost, "/api/v1/subscriptions", map[string]any{
		"customer_id":        cust.ID,
		"device_id":          env.Device.ID,
		"hotspot_profile_id": hsProf.ID,
		"service_type":       "hotspot",
		"mikrotik_username":  "sari-hs01",
		"mikrotik_password":  "rahasia123",
		"billing_day":        5,
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"status":"active"`)

	var createResp struct {
		Subscription struct {
			ID          uint   `json:"id"`
			ServiceType string `json:"service_type"`
			Status      string `json:"status"`
		} `json:"subscription"`
	}
	decodeData(t, w, &createResp)
	require.NotZero(t, createResp.Subscription.ID)
	assert.Equal(t, "hotspot", createResp.Subscription.ServiceType)
	assert.Equal(t, "active", createResp.Subscription.Status)

	env.Mock.AssertReceived(t, tcpmock.MatchAll(
		tcpmock.MatchCommand("/ip/hotspot/user/add"),
		tcpmock.MatchHas("name", "sari-hs01"),
		tcpmock.MatchHas("profile", "HS-Perm-5M"),
	), "hotspot user add dengan field benar")

	// Password ter-decrypt saat dibaca dari DB
	subID := createResp.Subscription.ID
	subDB, err := env.SubStore.Get(ctx, subID)
	require.NoError(t, err)
	assert.Equal(t, "rahasia123", subDB.MikrotikPassword, "Get harus decrypt")

	// PATCH isolir
	w = httpJSON(env.HTTP, http.MethodPatch,
		fmt.Sprintf("/api/v1/subscriptions/%d/status", subID),
		map[string]any{"status": "isolir"})
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"status":"isolir"`)

	// PATCH terminated → user remove di router
	w = httpJSON(env.HTTP, http.MethodPatch,
		fmt.Sprintf("/api/v1/subscriptions/%d/status", subID),
		map[string]any{"status": "terminated"})
	require.Equal(t, http.StatusOK, w.Code)
	env.Mock.AssertReceived(t, tcpmock.MatchCommand("/ip/hotspot/user/remove"),
		"terminate hotspot → user remove")
}

// ─── Invoice — manual generate ────────────────────────────────────────────

func TestIntegration_Billing_Invoice_ManualGenerate(t *testing.T) {
	env := setupBillingEnv(t)
	ctx := context.Background()

	cust, sub := seedBillingPPPSubscription(t, ctx, env, "Pak Manual", "081300002222")

	// POST /invoices/generate — manual
	periodStart := time.Now().Format("2006-01-02")
	w := httpJSON(env.HTTP, http.MethodPost, "/api/v1/invoices/generate", map[string]any{
		"subscription_id": sub.ID,
		"customer_id":     cust.ID,
		"period_start":    periodStart,
		"due_days":        14,
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())

	var invResp struct {
		ID            uint   `json:"id"`
		InvoiceNumber string `json:"invoice_number"`
		Amount        int64  `json:"amount"`
		Status        string `json:"status"`
	}
	decodeData(t, w, &invResp)
	require.NotZero(t, invResp.ID)
	assert.NotEmpty(t, invResp.InvoiceNumber)
	assert.Equal(t, int64(250000), invResp.Amount, "harga sesuai profil PPPoE")
	assert.Equal(t, "issued", invResp.Status)

	// GET /invoices/:id — verifikasi data tersimpan
	w = httpJSON(env.HTTP, http.MethodGet,
		fmt.Sprintf("/api/v1/invoices/%d", invResp.ID), nil)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), invResp.InvoiceNumber)

	// GET /invoices?customer_id= — verifikasi query filter
	w = httpJSON(env.HTTP, http.MethodGet,
		fmt.Sprintf("/api/v1/invoices?customer_id=%d", cust.ID), nil)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), invResp.InvoiceNumber)
}

func TestIntegration_Billing_Invoice_ManualGenerate_WithAmountOverride(t *testing.T) {
	env := setupBillingEnv(t)
	ctx := context.Background()

	cust, sub := seedBillingPPPSubscription(t, ctx, env, "Pak Override", "081300003333")

	w := httpJSON(env.HTTP, http.MethodPost, "/api/v1/invoices/generate", map[string]any{
		"subscription_id": sub.ID,
		"customer_id":     cust.ID,
		"period_start":    time.Now().Format("2006-01-02"),
		"due_days":        7,
		"amount":          300000, // override > harga profil (250k)
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())

	var invResp struct{ Amount int64 `json:"amount"` }
	decodeData(t, w, &invResp)
	assert.Equal(t, int64(300000), invResp.Amount, "override amount harus dipakai")
}

func TestIntegration_Billing_Invoice_ManualGenerate_DuplicatePeriod_Conflict(t *testing.T) {
	env := setupBillingEnv(t)
	ctx := context.Background()

	cust, sub := seedBillingPPPSubscription(t, ctx, env, "Pak Duplikat", "081300004444")

	body := map[string]any{
		"subscription_id": sub.ID,
		"customer_id":     cust.ID,
		"period_start":    "2026-06-01",
		"due_days":        7,
	}
	w := httpJSON(env.HTTP, http.MethodPost, "/api/v1/invoices/generate", body)
	require.Equal(t, http.StatusCreated, w.Code)
	// request kedua periode sama → 409 CONFLICT
	w = httpJSON(env.HTTP, http.MethodPost, "/api/v1/invoices/generate", body)
	assert.Equal(t, http.StatusConflict, w.Code, "periode duplikat harus 409")
}

func TestIntegration_Billing_Invoice_ManualGenerate_InvalidSubscription(t *testing.T) {
	env := setupBillingEnv(t)

	w := httpJSON(env.HTTP, http.MethodPost, "/api/v1/invoices/generate", map[string]any{
		"subscription_id": 9999,
		"customer_id":     1,
		"period_start":    "2026-06-01",
		"due_days":        7,
	})
	assert.Equal(t, http.StatusBadRequest, w.Code, "subscription tidak ada → 400")
}

func TestIntegration_Billing_Invoice_HotspotSubscription(t *testing.T) {
	env := setupBillingEnv(t)
	ctx := context.Background()

	cust, sub := seedBillingHotspotSubscription(t, ctx, env, "Pak Hotspot", "081500008888")

	w := httpJSON(env.HTTP, http.MethodPost, "/api/v1/invoices/generate", map[string]any{
		"subscription_id": sub.ID,
		"customer_id":     cust.ID,
		"period_start":    time.Now().Format("2006-01-02"),
		"due_days":        7,
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())

	var invResp struct {
		Amount int64  `json:"amount"`
		Status string `json:"status"`
	}
	decodeData(t, w, &invResp)
	assert.Equal(t, int64(99000), invResp.Amount, "harga dari hotspot profile")
	assert.Equal(t, "issued", invResp.Status)
}

// ─── Invoice — auto billing cron ─────────────────────────────────────────

func TestIntegration_Billing_BillingCron_GeneratesInvoice(t *testing.T) {
	env := setupBillingEnv(t)
	ctx := context.Background()

	cust, sub := seedBillingPPPSubscription(t, ctx, env, "Pak Cron", "081400005555")

	// Set next_invoice_date = hari ini supaya cron akan generate
	today := time.Now().Truncate(24 * time.Hour)
	require.NoError(t, env.SubStore.UpdateNextInvoiceDate(ctx, sub.ID, today))

	// Jalankan cron
	require.NoError(t, env.BillingCron.Run(ctx))

	// Invoice harus ter-generate
	invoices, err := env.InvStore.List(ctx, store.InvoiceListFilter{CustomerID: cust.ID})
	require.NoError(t, err)
	require.Len(t, invoices, 1, "cron harus generate 1 invoice")
	assert.Equal(t, "issued", invoices[0].Status)
	assert.Equal(t, int64(250000), invoices[0].Amount)
	assert.Equal(t, sub.ID, invoices[0].SubscriptionID)

	// next_invoice_date harus di-advance 1 bulan
	subUpdated, err := env.SubStore.Get(ctx, sub.ID)
	require.NoError(t, err)
	require.NotNil(t, subUpdated.NextInvoiceDate)
	assert.True(t, subUpdated.NextInvoiceDate.After(today),
		"next_invoice_date harus maju 1 bulan ke depan")
}

func TestIntegration_Billing_BillingCron_Idempotent(t *testing.T) {
	env := setupBillingEnv(t)
	ctx := context.Background()

	_, sub := seedBillingPPPSubscription(t, ctx, env, "Pak Idempoten", "081400006666")

	today := time.Now().Truncate(24 * time.Hour)
	require.NoError(t, env.SubStore.UpdateNextInvoiceDate(ctx, sub.ID, today))
	require.NoError(t, env.BillingCron.Run(ctx))

	// Simulasi double-run: reset ke hari ini
	require.NoError(t, env.SubStore.UpdateNextInvoiceDate(ctx, sub.ID, today))
	require.NoError(t, env.BillingCron.Run(ctx), "cron harus toleransi duplikat")

	invoices, err := env.InvStore.List(ctx, store.InvoiceListFilter{SubscriptionID: sub.ID})
	require.NoError(t, err)
	assert.Len(t, invoices, 1, "tetap 1 invoice meski cron jalan 2x (idempoten)")
}

func TestIntegration_Billing_BillingCron_SkipsNonToday(t *testing.T) {
	env := setupBillingEnv(t)
	ctx := context.Background()

	_, sub := seedBillingPPPSubscription(t, ctx, env, "Pak Besok", "081400007777")

	// next_invoice_date = besok → cron tidak generate hari ini
	tomorrow := time.Now().Truncate(24 * time.Hour).Add(24 * time.Hour)
	require.NoError(t, env.SubStore.UpdateNextInvoiceDate(ctx, sub.ID, tomorrow))
	require.NoError(t, env.BillingCron.Run(ctx))

	invoices, err := env.InvStore.List(ctx, store.InvoiceListFilter{SubscriptionID: sub.ID})
	require.NoError(t, err)
	assert.Len(t, invoices, 0, "next_invoice_date besok → tidak generate hari ini")
}

// ─── Laporan keuangan (financial reports) ─────────────────────────────────

func TestIntegration_Billing_Report_Financial_Monthly(t *testing.T) {
	env := setupBillingEnv(t)
	ctx := context.Background()

	_, sub := seedBillingPPPSubscription(t, ctx, env, "Pak Fin", "081600009999")

	now := time.Now()
	// Generate invoice bulan ini
	periodStartCurrent := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	_, err := env.BillingSvc.GenerateForSubscription(ctx, sub, periodStartCurrent, 7)
	require.NoError(t, err)
	// Generate invoice bulan lalu (bulan berbeda, tidak ikut summary bulan ini)
	periodStartPrev := periodStartCurrent.AddDate(0, -1, 0)
	_, err = env.BillingSvc.GenerateForSubscription(ctx, sub, periodStartPrev, 7)
	require.NoError(t, err)

	// GET /reports/financial?year=&month=
	w := httpJSON(env.HTTP, http.MethodGet,
		fmt.Sprintf("/api/v1/reports/financial?year=%d&month=%d", now.Year(), int(now.Month())), nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var finResp struct {
		Year         int   `json:"year"`
		Month        int   `json:"month"`
		TotalBilled  int64 `json:"total_billed"`
		InvoiceCount int   `json:"invoice_count"`
		PaidCount    int   `json:"paid_count"`
	}
	decodeData(t, w, &finResp)
	assert.Equal(t, now.Year(), finResp.Year)
	assert.Equal(t, int(now.Month()), finResp.Month)
	assert.Equal(t, int64(250000), finResp.TotalBilled, "1 invoice bulan ini × 250k")
	assert.Equal(t, 1, finResp.InvoiceCount, "hanya invoice bulan ini yang dihitung")
	assert.Equal(t, 0, finResp.PaidCount)
}

func TestIntegration_Billing_Report_Aging(t *testing.T) {
	env := setupBillingEnv(t)
	ctx := context.Background()

	_, sub := seedBillingPPPSubscription(t, ctx, env, "Pak Aging", "081700000001")

	// Generate invoice dengan due_date masa lalu supaya masuk aging overdue
	periodStart := time.Now().AddDate(0, -2, 0)
	_, err := env.BillingSvc.GenerateForSubscription(ctx, sub, periodStart, 1) // due_days=1
	require.NoError(t, err)

	w := httpJSON(env.HTTP, http.MethodGet, "/api/v1/reports/aging", nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var agingResp struct {
		AsOf    string `json:"as_of"`
		Buckets []struct {
			Label       string `json:"label"`
			Count       int    `json:"count"`
			TotalAmount int64  `json:"total_amount"`
		} `json:"buckets"`
	}
	decodeData(t, w, &agingResp)
	assert.NotEmpty(t, agingResp.AsOf)

	totalCount := 0
	for _, b := range agingResp.Buckets {
		totalCount += b.Count
	}
	assert.GreaterOrEqual(t, totalCount, 1, "harus ada ≥1 invoice overdue di aging")
}

func TestIntegration_Billing_Report_Dashboard(t *testing.T) {
	env := setupBillingEnv(t)
	ctx := context.Background()

	_, sub := seedBillingPPPSubscription(t, ctx, env, "Pak Dashboard", "081700000002")
	require.NoError(t, env.SubStore.UpdateStatus(ctx, sub.ID, "active", nil, nil))

	w := httpJSON(env.HTTP, http.MethodGet, "/api/v1/reports/dashboard", nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var dashResp struct {
		ActiveSubscriptions int `json:"active_subscriptions"`
		TotalCustomers      int `json:"total_customers"`
	}
	decodeData(t, w, &dashResp)
	assert.GreaterOrEqual(t, dashResp.ActiveSubscriptions, 1)
	assert.GreaterOrEqual(t, dashResp.TotalCustomers, 1)
}

func TestIntegration_Billing_Report_Churn(t *testing.T) {
	env := setupBillingEnv(t)
	ctx := context.Background()

	_, sub := seedBillingPPPSubscription(t, ctx, env, "Pak Churn", "081700000003")
	now := time.Now()
	require.NoError(t, env.SubStore.UpdateStatus(ctx, sub.ID, "terminated", nil, &now))

	w := httpJSON(env.HTTP, http.MethodGet,
		fmt.Sprintf("/api/v1/reports/churn?year=%d", now.Year()), nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"data"`)
}

// ─── Laporan penjualan voucher ─────────────────────────────────────────────

func TestIntegration_Billing_Report_VoucherSelling(t *testing.T) {
	env := setupBillingEnv(t)
	ctx := context.Background()

	now := time.Now()
	saleMonth := strings.ToLower(now.Format("Jan2006"))
	saleDate := strings.ToLower(now.Format("Jan/02/2006"))

	// Tulis 3 transaksi voucher langsung ke DB (simulate on-login hook)
	for i := 0; i < 3; i++ {
		tx := &model.Transaction{
			DeviceID:  env.Device.ID,
			SaleDate:  saleDate,
			SaleTime:  now.Format("15:04:05"),
			SaleMonth: saleMonth,
			Username:  fmt.Sprintf("user-voucher-%d", i),
			Profile:   "Voucher-1Hari",
			Price:     5000,
			SellPrice: 7000,
			Validity:  "1d",
		}
		require.NoError(t, env.TxStore.Create(ctx, tx))
	}

	// GET /reports/selling?month= — semua transaksi bulan ini
	w := httpJSON(env.HTTP, http.MethodGet,
		fmt.Sprintf("/api/v1/devices/%d/reports/selling?month=%s", env.Device.ID, saleMonth), nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	var txList []struct {
		Username string `json:"username"`
		Profile  string `json:"profile"`
	}
	decodeData(t, w, &txList)
	assert.Len(t, txList, 3)

	// GET /reports/selling/today — transaksi hari ini
	w = httpJSON(env.HTTP, http.MethodGet,
		fmt.Sprintf("/api/v1/devices/%d/reports/selling/today", env.Device.ID), nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"count":3`)

	// GET /reports/selling/summary?include_transactions=true
	w = httpJSON(env.HTTP, http.MethodGet,
		fmt.Sprintf("/api/v1/devices/%d/reports/selling/summary?month=%s&include_transactions=true",
			env.Device.ID, saleMonth), nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var summary struct {
		Count          int `json:"count"`
		TotalPrice     int `json:"total_price"`
		TotalSellPrice int `json:"total_sell_price"`
		Profit         int `json:"profit"`
	}
	decodeData(t, w, &summary)
	assert.Equal(t, 3, summary.Count)
	assert.Equal(t, 15000, summary.TotalPrice)
	assert.Equal(t, 21000, summary.TotalSellPrice)
	assert.Equal(t, 6000, summary.Profit)

	// GET /reports/selling.csv — verifikasi output CSV
	w = httpJSON(env.HTTP, http.MethodGet,
		fmt.Sprintf("/api/v1/devices/%d/reports/selling.csv?month=%s", env.Device.ID, saleMonth), nil)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Header().Get("Content-Type"), "text/csv")
	assert.Contains(t, w.Body.String(), "Voucher-1Hari")
	assert.Contains(t, w.Body.String(), "user-voucher-0")
}

// ─── helpers ──────────────────────────────────────────────────────────────

// seedBillingPPPSubscription membuat customer + ppp profile + subscription aktif (PPPoE).
func seedBillingPPPSubscription(
	t *testing.T, ctx context.Context, env billingEnv, name, phone string,
) (model.Customer, model.Subscription) {
	t.Helper()
	cust := &model.Customer{FullName: name, Phone: phone, Status: "aktif"}
	require.NoError(t, env.CustStore.Create(ctx, cust))

	pp := &model.PPPProfile{
		DeviceID: env.Device.ID, Name: "PPP-" + phone,
		RateLimit: "20M/20M", PriceMonthly: 250000, Active: true,
	}
	require.NoError(t, env.PPPStore.Create(ctx, pp))

	sub := &model.Subscription{
		CustomerID: cust.ID, DeviceID: env.Device.ID,
		PPPProfileID: &pp.ID,
		ServiceType:  "pppoe", MikrotikUsername: "u-" + phone,
		MikrotikPassword: "pw", Status: "active",
	}
	require.NoError(t, env.SubStore.Create(ctx, sub))
	require.NoError(t, env.SubStore.UpdateStatus(ctx, sub.ID, "active", nil, nil))

	updated, err := env.SubStore.Get(ctx, sub.ID)
	require.NoError(t, err)
	return *cust, updated
}

// seedBillingHotspotSubscription membuat customer + hotspot profile + subscription aktif (Hotspot).
func seedBillingHotspotSubscription(
	t *testing.T, ctx context.Context, env billingEnv, name, phone string,
) (model.Customer, model.Subscription) {
	t.Helper()
	cust := &model.Customer{FullName: name, Phone: phone, Status: "aktif"}
	require.NoError(t, env.CustStore.Create(ctx, cust))

	hsProf := &model.HotspotProfile{
		DeviceID: env.Device.ID, Name: "HS-" + phone,
		Role: "permanent", RateLimit: "5M/5M", PriceMonthly: 99000,
		SharedUsers: 1, Active: true, ExpiryMode: "0",
	}
	_, err := env.HSStore.Upsert(ctx, hsProf)
	require.NoError(t, err)

	sub := &model.Subscription{
		CustomerID: cust.ID, DeviceID: env.Device.ID,
		HotspotProfileID: &hsProf.ID,
		ServiceType:      "hotspot", MikrotikUsername: "hs-u-" + phone,
		MikrotikPassword: "pw", Status: "active",
	}
	require.NoError(t, env.SubStore.Create(ctx, sub))
	require.NoError(t, env.SubStore.UpdateStatus(ctx, sub.ID, "active", nil, nil))

	updated, err := env.SubStore.Get(ctx, sub.ID)
	require.NoError(t, err)
	return *cust, updated
}
