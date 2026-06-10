//go:build dbtest

package integration

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/job"
	"github.com/quiqxiq/rosmon/service/billing"
	paymentSvc "github.com/quiqxiq/rosmon/service/payment"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── Env setup ──────────────────────────────────────────────────────────────────

type suspFlowEnv struct {
	HTTP           http.Handler
	Mock           *tcpmock.Server
	Device         model.MikrotikDevice
	CustStore      store.CustomerStore
	PPPStore       store.PPPProfileStore
	SubStore       store.SubscriptionStore
	InvStore       store.InvoiceStore
	AuditStore     store.AuditLogStore
	SettingStore   store.SettingStore
	SuspCheck      *job.SuspensionCheckJob
	OutboxJob      *job.OutboxJob
	PaymentService *paymentSvc.Service
}

func setupSuspFlowEnv(t *testing.T, nowFunc func() time.Time) suspFlowEnv {
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
	auditStore := store.NewAuditLogStore(db)
	payStore := store.NewPaymentStore(db)

	mgr, srv, dev := testutil.NewTestDevMgr(t)
	require.NoError(t, devStore.Create(context.Background(), &dev))

	log := logrus.New()
	log.SetLevel(logrus.WarnLevel)

	// Billing service (untuk GenerateInvoice)
	billingSvc := billing.New(billing.Deps{
		Invoices:  invStore,
		Sequences: seqStore,
		PPP:       pppStore,
		Hotspot:   hsStore,
		NowFunc:   time.Now,
	})

	// SuspensionCheckJob dengan NowFunc injectable
	suspCheck := job.NewSuspensionCheckJob(
		subStore, custStore, invStore, settStore, nil, // nil notification (best-effort)
		auditStore, nowFunc, log,
	)

	// OutboxJob — eksekusi DB → MikroTik
	outbox := job.NewOutboxJob(subStore, pppStore, hsStore, settStore, mgr, log)

	// PaymentService (manual cash confirm)
	paySvc := paymentSvc.New(paymentSvc.Deps{
		Payments:      payStore,
		Invoices:      invStore,
		Customers:     custStore,
		Subscriptions: subStore,
		Settings:      settStore,
		AuditLog:      auditStore,
		Log:           log,
	})

	// Seed default settings untuk billing thresholds
	ctx := context.Background()
	_ = settStore.Set(ctx, "billing.isolir_after_days", "3")
	_ = settStore.Set(ctx, "billing.hard_suspend_after_days", "14")
	_ = settStore.Set(ctx, "billing.isolir_profile_name", "throttle-1mbps")

	// HTTP router
	r := gin.New()
	g := r.Group("/api/v1")
	handler.NewCustomers(custStore).Register(g)
	sh := handler.NewSubscriptions(subStore, custStore, pppStore, hsStore, settStore, mgr, log)
	sh.Audit = auditStore
	sh.Register(g)
	invH := handler.NewInvoices(invStore, seqStore)
	invH.SubStore = subStore
	invH.Billing = billingSvc
	invH.Audit = auditStore
	invH.RegisterRead(g)
	invH.RegisterWrite(g)
	ph := handler.NewPayments(payStore, invStore, subStore, custStore, nil, auditStore, settStore, paySvc, log)
	ph.Register(g)

	return suspFlowEnv{
		HTTP:           r,
		Mock:           srv,
		Device:         dev,
		CustStore:      custStore,
		PPPStore:       pppStore,
		SubStore:       subStore,
		InvStore:       invStore,
		AuditStore:     auditStore,
		SettingStore:   settStore,
		SuspCheck:      suspCheck,
		OutboxJob:      outbox,
		PaymentService: paySvc,
	}
}

// ── Seed helpers ───────────────────────────────────────────────────────────────

// seedActivePPPSub membuat customer + PPP profile + subscription active.
// Mengembalikan sub yang sudah dibuat.
func seedActivePPPSub(t *testing.T, env suspFlowEnv, username string) (model.Customer, model.PPPProfile, model.Subscription) {
	t.Helper()
	ctx := context.Background()

	cust := &model.Customer{FullName: fmt.Sprintf("Pak %s", username), Phone: fmt.Sprintf("0800%s", username), Status: "aktif"}
	require.NoError(t, env.CustStore.Create(ctx, cust))

	pp := &model.PPPProfile{DeviceID: env.Device.ID, Name: fmt.Sprintf("paket-%s", username), RateLimit: "20M/20M", PriceMonthly: 200000, Active: true}
	require.NoError(t, env.PPPStore.Create(ctx, pp))

	sub := &model.Subscription{
		CustomerID:       cust.ID,
		DeviceID:         env.Device.ID,
		PPPProfileID:     &pp.ID,
		ServiceType:      "pppoe",
		Status:           "active",
		SyncStatus:       "synced",
		MikrotikUsername: username,
		MikrotikPassword: "testpass",
	}
	require.NoError(t, env.SubStore.Create(ctx, sub))
	// Set status langsung ke active (bypass pending_install)
	now := time.Now()
	require.NoError(t, env.SubStore.UpdateStatus(ctx, sub.ID, "active", &now, nil))
	require.NoError(t, env.SubStore.UpdateSyncStatus(ctx, sub.ID, "synced", "test seed"))

	subVal, err := env.SubStore.Get(ctx, sub.ID)
	require.NoError(t, err)

	return *cust, *pp, subVal
}

// seedOverdueInvoice membuat invoice dengan DueDate di masa lampau.
func seedOverdueInvoice(t *testing.T, env suspFlowEnv, cust model.Customer, sub model.Subscription, dueDate time.Time) model.Invoice {
	t.Helper()
	ctx := context.Background()

	inv := &model.Invoice{
		CustomerID:     cust.ID,
		SubscriptionID: sub.ID,
		InvoiceNumber:  fmt.Sprintf("INV-IT-%d", sub.ID),
		Amount:         200000,
		Status:         "issued",
		DueDate:        dueDate,
	}
	require.NoError(t, env.InvStore.Create(ctx, inv, nil))
	return *inv
}

// ── Mock router helpers ────────────────────────────────────────────────────────

// mockPPPSecret mendaftarkan responses untuk operasi PPP secret di tcpmock.
func mockPPPSecret(env suspFlowEnv, username, profileName string) {
	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/print"),
		tcpmock.ReReply("=.id=*S1", "=name="+username, "=service=pppoe", "=profile="+profileName, "=disabled=false"),
		tcpmock.DoneReply(),
	)
	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/set"), tcpmock.DoneReply())
}

// ── Skenario 1: Invoice overdue → job → isolir → outbox → router ──────────────

func TestIntegration_Suspension_Skenario1_InvoiceOverdue_Isolir(t *testing.T) {
	now := time.Now()
	isolirAfterDays := 3
	jobNow := now.Add(24 * time.Duration(isolirAfterDays) * time.Hour) // job berjalan 3 hari setelah due

	env := setupSuspFlowEnv(t, func() time.Time { return jobNow })
	ctx := context.Background()

	cust, pp, sub := seedActivePPPSub(t, env, "budi-s1")
	dueDate := now // due date = hari ini, job berjalan 3 hari kemudian

	seedOverdueInvoice(t, env, cust, sub, dueDate)

	// Mock router: set → success
	mockPPPSecret(env, "budi-s1", pp.Name)

	// Jalankan job
	require.NoError(t, env.SuspCheck.Run(ctx))

	// Verifikasi DB: status = isolir, sync_status = pending_profile_change
	updatedSub, err := env.SubStore.Get(ctx, sub.ID)
	require.NoError(t, err)
	assert.Equal(t, "isolir", updatedSub.Status, "sub harus isolir setelah job")
	assert.Equal(t, "pending_profile_change", updatedSub.SyncStatus)

	// Jalankan outbox → push ke router
	require.NoError(t, env.OutboxJob.Run(ctx))

	// Verifikasi tcpmock menerima /ppp/secret/set dengan profile throttle
	env.Mock.AssertReceived(t, tcpmock.MatchAll(
		tcpmock.MatchCommand("/ppp/secret/set"),
	), "outbox harus push /ppp/secret/set ke router")

	// Verifikasi audit log
	entries, err := env.AuditStore.List(ctx, store.AuditLogFilter{
		EntityType: "subscription",
		Action:     "subscription_status_changed",
	})
	require.NoError(t, err)
	require.NotEmpty(t, entries, "audit log harus ada")
	assert.Contains(t, entries[0].NewValues, "isolir")
}

// ── Skenario 2: Customer bayar → invoice paid → sub active → outbox restore ───

func TestIntegration_Suspension_Skenario2_PaymentConfirm_RestoreActive(t *testing.T) {
	now := time.Now()
	env := setupSuspFlowEnv(t, time.Now)
	ctx := context.Background()

	cust, _, sub := seedActivePPPSub(t, env, "citra-s2")

	// Sub sudah isolir (simulate setelah job)
	require.NoError(t, env.SubStore.UpdateStatus(ctx, sub.ID, "isolir", nil, nil))
	require.NoError(t, env.SubStore.UpdateSyncStatus(ctx, sub.ID, "synced", "isolir by job"))

	dueDate := now.AddDate(0, 0, -5)
	inv := seedOverdueInvoice(t, env, cust, sub, dueDate)

	// Mock router: restore → /ppp/secret/set
	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/print"),
		tcpmock.ReReply("=.id=*S2", "=name=citra-s2", "=service=pppoe", "=profile=throttle-1mbps", "=disabled=false"),
		tcpmock.DoneReply(),
	)
	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/set"), tcpmock.DoneReply())

	// Admin konfirmasi payment manual (cash)
	actorID := uint(1)
	payment := &model.Payment{
		InvoiceID:  inv.ID,
		CustomerID: cust.ID,
		Amount:     inv.Amount,
		Method:     "cash",
	}
	_, err := env.PaymentService.CreateManual(ctx, payment, &actorID)
	require.NoError(t, err)

	// Verifikasi invoice paid + sub active
	updatedInv, err := env.InvStore.GetByID(ctx, inv.ID)
	require.NoError(t, err)
	assert.Equal(t, "paid", updatedInv.Status)

	updatedSub, err := env.SubStore.Get(ctx, sub.ID)
	require.NoError(t, err)
	assert.Equal(t, "active", updatedSub.Status, "sub harus kembali active setelah bayar")
	assert.Contains(t, []string{"pending_profile_change", "pending_enable"}, updatedSub.SyncStatus,
		"sync_status harus pending_profile_change atau pending_enable (restore)")

	// Jalankan outbox → push restore ke router
	require.NoError(t, env.OutboxJob.Run(ctx))

	env.Mock.AssertReceived(t, tcpmock.MatchCommand("/ppp/secret/set"), "outbox harus push restore ke router")
}

// ── Skenario 3: Admin catat cash payment → invoice paid → koneksi aktif ──────

func TestIntegration_Suspension_Skenario3_CashPayment_RestoreActive(t *testing.T) {
	now := time.Now()
	env := setupSuspFlowEnv(t, time.Now)
	ctx := context.Background()

	cust, _, sub := seedActivePPPSub(t, env, "dedi-s3")

	// Sub suspended
	require.NoError(t, env.SubStore.UpdateStatus(ctx, sub.ID, "suspended", nil, nil))
	require.NoError(t, env.SubStore.UpdateSyncStatus(ctx, sub.ID, "synced", "suspended by job"))

	dueDate := now.AddDate(0, 0, -14)
	inv := seedOverdueInvoice(t, env, cust, sub, dueDate)

	// Mock restore
	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/print"),
		tcpmock.ReReply("=.id=*S3", "=name=dedi-s3", "=service=pppoe", "=profile=dedi-s3-paket", "=disabled=true"),
		tcpmock.DoneReply(),
	)
	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/set"), tcpmock.DoneReply())

	// Catat payment cash melalui HTTP API
	w := httpJSON(env.HTTP, http.MethodPost, "/api/v1/payments", map[string]any{
		"invoice_id":  inv.ID,
		"customer_id": cust.ID,
		"amount":      inv.Amount,
		"method":      "cash",
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())

	// Invoice harus paid, sub harus active
	updatedInv, err := env.InvStore.GetByID(ctx, inv.ID)
	require.NoError(t, err)
	assert.Equal(t, "paid", updatedInv.Status)

	updatedSub, err := env.SubStore.Get(ctx, sub.ID)
	require.NoError(t, err)
	assert.Equal(t, "active", updatedSub.Status)
}

// ── Skenario 4: Manual admin PATCH suspended → audit_log → outbox disable ─────

func TestIntegration_Suspension_Skenario4_ManualSuspend_AuditAndOutbox(t *testing.T) {
	env := setupSuspFlowEnv(t, time.Now)
	ctx := context.Background()

	_, _, sub := seedActivePPPSub(t, env, "eko-s4")

	// Mock router untuk disable
	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/print"),
		tcpmock.ReReply("=.id=*S4", "=name=eko-s4", "=service=pppoe", "=profile=paket-eko-s4", "=disabled=false"),
		tcpmock.DoneReply(),
	)
	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/set"), tcpmock.DoneReply())

	// Manual PATCH via HTTP API
	w := httpJSON(env.HTTP, http.MethodPatch,
		fmt.Sprintf("/api/v1/subscriptions/%d/status", sub.ID),
		map[string]any{"status": "suspended"},
	)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	// Verifikasi DB
	updatedSub, err := env.SubStore.Get(ctx, sub.ID)
	require.NoError(t, err)
	assert.Equal(t, "suspended", updatedSub.Status)

	// Verifikasi audit log ditulis oleh handler
	entries, err := env.AuditStore.List(ctx, store.AuditLogFilter{
		EntityType: "subscription",
		Action:     "subscription_status_changed",
	})
	require.NoError(t, err)
	require.NotEmpty(t, entries, "audit log harus ditulis saat manual PATCH")

	// Jalankan outbox → disable di router
	require.NoError(t, env.OutboxJob.Run(ctx))

	env.Mock.AssertReceived(t, tcpmock.MatchAll(
		tcpmock.MatchCommand("/ppp/secret/set"),
		tcpmock.MatchHas("disabled", "yes"),
	), "outbox harus send /ppp/secret/set disabled=yes")
}

// ── Skenario 5: Invoice cancelled → koneksi tidak terpengaruh ─────────────────

func TestIntegration_Suspension_Skenario5_InvoiceCancelled_SubUnchanged(t *testing.T) {
	env := setupSuspFlowEnv(t, time.Now)
	ctx := context.Background()

	cust, _, sub := seedActivePPPSub(t, env, "fani-s5")
	inv := seedOverdueInvoice(t, env, cust, sub, time.Now().AddDate(0, 0, 1)) // belum overdue

	// Cancel invoice via API
	w := httpJSON(env.HTTP, http.MethodPost,
		fmt.Sprintf("/api/v1/invoices/%d/cancel", inv.ID), nil,
	)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	// Sub status tidak berubah
	updatedSub, err := env.SubStore.Get(ctx, sub.ID)
	require.NoError(t, err)
	assert.Equal(t, "active", updatedSub.Status, "cancel invoice tidak mengubah status subscription")
}

// ── Skenario 6: Idempotensi — job 2x tidak ganda aksi/audit ──────────────────

func TestIntegration_Suspension_Skenario6_Idempotent_DoubleRun(t *testing.T) {
	now := time.Now()
	isolirAfterDays := 3
	jobNow := now.Add(24 * time.Duration(isolirAfterDays) * time.Hour)

	env := setupSuspFlowEnv(t, func() time.Time { return jobNow })
	ctx := context.Background()

	cust, _, sub := seedActivePPPSub(t, env, "gita-s6")
	dueDate := now
	seedOverdueInvoice(t, env, cust, sub, dueDate)

	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/print"),
		tcpmock.ReReply("=.id=*S6", "=name=gita-s6", "=service=pppoe", "=profile=paket-gita-s6", "=disabled=false"),
		tcpmock.DoneReply(),
	)
	env.Mock.OnSentence(tcpmock.MatchCommand("/ppp/secret/set"), tcpmock.DoneReply())

	// Run pertama → sub jadi isolir
	require.NoError(t, env.SuspCheck.Run(ctx))

	sub1, err := env.SubStore.Get(ctx, sub.ID)
	require.NoError(t, err)
	assert.Equal(t, "isolir", sub1.Status)

	entries1, err := env.AuditStore.List(ctx, store.AuditLogFilter{
		EntityType: "subscription",
		Action:     "subscription_status_changed",
	})
	require.NoError(t, err)
	count1 := len(entries1)
	require.Equal(t, 1, count1, "run pertama harus ada tepat 1 audit entry")

	// Run kedua → sub sudah isolir, tidak ada perubahan
	require.NoError(t, env.SuspCheck.Run(ctx))

	sub2, err := env.SubStore.Get(ctx, sub.ID)
	require.NoError(t, err)
	assert.Equal(t, "isolir", sub2.Status, "status tidak berubah di run ke-2")

	entries2, err := env.AuditStore.List(ctx, store.AuditLogFilter{
		EntityType: "subscription",
		Action:     "subscription_status_changed",
	})
	require.NoError(t, err)
	assert.Equal(t, count1, len(entries2), "audit log tidak dobel di run ke-2")
}
