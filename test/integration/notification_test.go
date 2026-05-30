//go:build dbtest

package integration

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/service/notification"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// stubSender — Sender terkontrol untuk integration test (tanpa WhatsApp nyata).
type stubSender struct{ err error }

func (s *stubSender) Send(_ context.Context, _, _ string) (string, error) {
	if s.err != nil {
		return "", s.err
	}
	return "stub-msgid", nil
}
func (s *stubSender) Name() string { return "stub" }

// ── Fase 0: foundation stores ──────────────────────────────────────────────

func TestIntegration_Foundation_TemplatesSeeded(t *testing.T) {
	db := testutil.NewPostgres(t)
	tplStore := store.NewTemplateStore(db)

	tpl, err := tplStore.GetBySlug(context.Background(), "invoice_issued")
	require.NoError(t, err)
	assert.NotEmpty(t, tpl.Body)
	assert.True(t, tpl.Active)

	all, err := tplStore.List(context.Background())
	require.NoError(t, err)
	assert.GreaterOrEqual(t, len(all), 13, "semua template default harus ter-seed saat migrate")
}

func TestIntegration_AuditLog_CreateAndFilter(t *testing.T) {
	db := testutil.NewPostgres(t)
	s := store.NewAuditLogStore(db)
	ctx := context.Background()

	uid, eid := uint(1), uint(42)
	require.NoError(t, s.Create(ctx, &model.AuditLog{
		UserID: &uid, Action: "isolir", EntityType: "Subscription", EntityID: &eid,
		OldValues: `{"status":"active"}`, NewValues: `{"status":"isolir"}`,
	}))
	require.NoError(t, s.Create(ctx, &model.AuditLog{Action: "confirm", EntityType: "Payment"}))

	got, err := s.List(ctx, store.AuditLogFilter{EntityType: "Subscription"})
	require.NoError(t, err)
	require.Len(t, got, 1)
	assert.Equal(t, "isolir", got[0].Action)
	require.NotNil(t, got[0].EntityID)
	assert.Equal(t, uint(42), *got[0].EntityID)
}

func TestIntegration_NotificationLog_RetryLifecycle(t *testing.T) {
	db := testutil.NewPostgres(t)
	s := store.NewNotificationLogStore(db)
	ctx := context.Background()
	now := time.Now()

	l := &model.NotificationLog{TemplateSlug: "invoice_issued", RecipientPhone: "0811", MessageBody: "x"}
	require.NoError(t, s.Create(ctx, l))
	require.NotZero(t, l.ID)

	// MarkFailed dengan next_retry di masa lalu → muncul di ListPendingRetry.
	require.NoError(t, s.MarkFailed(ctx, l.ID, "down", now.Add(-time.Minute)))
	pend, err := s.ListPendingRetry(ctx, now, 10)
	require.NoError(t, err)
	require.Len(t, pend, 1)
	assert.Equal(t, 1, pend[0].RetryCount)

	// MarkSent → keluar dari antrian retry.
	require.NoError(t, s.MarkSent(ctx, l.ID, "ok", now))
	pend, err = s.ListPendingRetry(ctx, now, 10)
	require.NoError(t, err)
	assert.Empty(t, pend)
}

// ── Fase 1: notification.Service end-to-end (real DB, stub sender) ──────────

func TestIntegration_NotificationService_SendAndRetry(t *testing.T) {
	db := testutil.NewPostgres(t)
	ctx := context.Background()

	settingStore := store.NewSettingStore(db)
	tplStore := store.NewTemplateStore(db)
	logStore := store.NewNotificationLogStore(db)
	require.NoError(t, settingStore.Set(ctx, "notification.wa_enabled", "true"))

	now := time.Now()
	sender := &stubSender{}
	svc := notification.New(notification.Deps{
		Sender:    sender,
		Templates: tplStore,
		Logs:      logStore,
		Settings:  settingStore,
		NowFunc:   func() time.Time { return now },
	})

	// Sukses → log sent, body ter-render.
	require.NoError(t, svc.Notify(ctx, nil, "081234", "invoice_issued", map[string]string{
		"customer_name": "Budi", "invoice_number": "INV-1", "amount": "100.000",
	}))
	sent, err := logStore.List(ctx, store.NotificationLogFilter{Status: "sent"})
	require.NoError(t, err)
	require.Len(t, sent, 1)
	assert.Contains(t, sent[0].MessageBody, "Budi")

	// Gagal → log failed.
	sender.err = errors.New("not connected")
	_ = svc.Notify(ctx, nil, "081299", "invoice_overdue", map[string]string{"invoice_number": "INV-2"})
	failed, err := logStore.List(ctx, store.NotificationLogFilter{Status: "failed"})
	require.NoError(t, err)
	require.Len(t, failed, 1)

	// Sender pulih + waktu maju melewati backoff → retry menandai sent.
	sender.err = nil
	now = now.Add(30 * time.Minute)
	n, err := svc.RetryPending(ctx, 10)
	require.NoError(t, err)
	assert.Equal(t, 1, n)

	failed, err = logStore.List(ctx, store.NotificationLogFilter{Status: "failed"})
	require.NoError(t, err)
	assert.Empty(t, failed, "semua failed sudah ter-resend")
}

// TestIntegration_NotificationService_DisabledSkips memastikan saat
// wa_enabled=false notifikasi dicatat 'skipped' dan sender tidak dipanggil.
func TestIntegration_NotificationService_DisabledSkips(t *testing.T) {
	db := testutil.NewPostgres(t)
	ctx := context.Background()

	settingStore := store.NewSettingStore(db) // wa_enabled default 'false' dari seed
	tplStore := store.NewTemplateStore(db)
	logStore := store.NewNotificationLogStore(db)

	sender := &stubSender{err: errors.New("should not be called")}
	svc := notification.New(notification.Deps{
		Sender: sender, Templates: tplStore, Logs: logStore, Settings: settingStore,
	})

	require.NoError(t, svc.Notify(ctx, nil, "081234", "invoice_issued", nil))
	skipped, err := logStore.List(ctx, store.NotificationLogFilter{Status: "skipped"})
	require.NoError(t, err)
	require.Len(t, skipped, 1)
}
