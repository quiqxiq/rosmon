package notification_test

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/quiqxiq/rosmon/service/notification"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ── fakes ────────────────────────────────────────────────────────────────

type fakeSettings struct{ m map[string]string }

func (f *fakeSettings) Get(_ context.Context, k string) (string, error) {
	v, ok := f.m[k]
	if !ok {
		return "", store.ErrSettingNotFound
	}
	return v, nil
}
func (f *fakeSettings) Set(_ context.Context, k, v string) error { f.m[k] = v; return nil }
func (f *fakeSettings) List(_ context.Context) ([]model.SystemSetting, error) { return nil, nil }

var _ store.SettingStore = (*fakeSettings)(nil)

type fakeTemplates struct{ m map[string]model.MessageTemplate }

func (f *fakeTemplates) GetBySlug(_ context.Context, slug string) (model.MessageTemplate, error) {
	t, ok := f.m[slug]
	if !ok {
		return t, store.ErrTemplateNotFound
	}
	return t, nil
}
func (f *fakeTemplates) List(_ context.Context) ([]model.MessageTemplate, error) { return nil, nil }
func (f *fakeTemplates) Update(_ context.Context, _ *model.MessageTemplate) error { return nil }

var _ store.TemplateStore = (*fakeTemplates)(nil)

type fakeLogs struct {
	mu   sync.Mutex
	rows map[uint]*model.NotificationLog
	seq  uint
}

func newFakeLogs() *fakeLogs { return &fakeLogs{rows: map[uint]*model.NotificationLog{}} }

func (f *fakeLogs) Create(_ context.Context, l *model.NotificationLog) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if l.Status == "" {
		l.Status = "pending"
	}
	f.seq++
	l.ID = f.seq
	cp := *l
	f.rows[l.ID] = &cp
	return nil
}

func (f *fakeLogs) MarkSent(_ context.Context, id uint, resp string, sentAt time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	r, ok := f.rows[id]
	if !ok {
		return store.ErrNotificationLogNotFound
	}
	r.Status = "sent"
	r.ProviderResponse = resp
	r.SentAt = &sentAt
	r.NextRetryAt = nil
	return nil
}

func (f *fakeLogs) MarkFailed(_ context.Context, id uint, resp string, next time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	r, ok := f.rows[id]
	if !ok {
		return store.ErrNotificationLogNotFound
	}
	r.Status = "failed"
	r.ProviderResponse = resp
	r.NextRetryAt = &next
	r.RetryCount++
	return nil
}

func (f *fakeLogs) ListPendingRetry(_ context.Context, now time.Time, _ int) ([]model.NotificationLog, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []model.NotificationLog
	for _, r := range f.rows {
		if r.Status == "failed" && (r.NextRetryAt == nil || !r.NextRetryAt.After(now)) {
			out = append(out, *r)
		}
	}
	return out, nil
}

func (f *fakeLogs) List(_ context.Context, _ store.NotificationLogFilter) ([]model.NotificationLog, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []model.NotificationLog
	for _, r := range f.rows {
		out = append(out, *r)
	}
	return out, nil
}

func (f *fakeLogs) get(id uint) model.NotificationLog {
	f.mu.Lock()
	defer f.mu.Unlock()
	return *f.rows[id]
}

var _ store.NotificationLogStore = (*fakeLogs)(nil)

type fakeSender struct {
	mu    sync.Mutex
	calls int
	err   error
}

func (s *fakeSender) Send(_ context.Context, _, _ string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.calls++
	if s.err != nil {
		return "", s.err
	}
	return "msgid-123", nil
}
func (s *fakeSender) Name() string { return "fake" }

func (s *fakeSender) callCount() int { s.mu.Lock(); defer s.mu.Unlock(); return s.calls }

// ── helpers ──────────────────────────────────────────────────────────────

var fixedNow = time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)

func newService(sender notification.Sender, logs *fakeLogs, enabled bool) *notification.Service {
	settings := &fakeSettings{m: map[string]string{}}
	if enabled {
		settings.m["notification.wa_enabled"] = "true"
	}
	tpl := &fakeTemplates{m: map[string]model.MessageTemplate{
		"invoice_issued": {Slug: "invoice_issued", Body: "Halo {{.customer_name}}, tagihan {{.invoice_number}}", Active: true},
	}}
	return notification.New(notification.Deps{
		Sender:    sender,
		Templates: tpl,
		Logs:      logs,
		Settings:  settings,
		NowFunc:   func() time.Time { return fixedNow },
	})
}

// ── tests ────────────────────────────────────────────────────────────────

func TestNotify_Disabled_Skipped(t *testing.T) {
	sender := &fakeSender{}
	logs := newFakeLogs()
	svc := newService(sender, logs, false)

	err := svc.Notify(context.Background(), nil, "0811", "invoice_issued", map[string]string{"customer_name": "Budi"})
	require.NoError(t, err)
	assert.Equal(t, 0, sender.callCount(), "sender tidak boleh dipanggil saat wa_enabled=false")
	require.Equal(t, "skipped", logs.get(1).Status)
}

func TestNotify_Success_MarksSent(t *testing.T) {
	sender := &fakeSender{}
	logs := newFakeLogs()
	svc := newService(sender, logs, true)

	err := svc.Notify(context.Background(), nil, "0811", "invoice_issued", map[string]string{
		"customer_name": "Budi", "invoice_number": "INV-1",
	})
	require.NoError(t, err)
	assert.Equal(t, 1, sender.callCount())
	got := logs.get(1)
	assert.Equal(t, "sent", got.Status)
	assert.Equal(t, "msgid-123", got.ProviderResponse)
	require.NotNil(t, got.SentAt)
	assert.Contains(t, got.MessageBody, "Halo Budi, tagihan INV-1")
}

func TestNotify_SendFail_MarksFailedWithRetry(t *testing.T) {
	sender := &fakeSender{err: errors.New("not connected")}
	logs := newFakeLogs()
	svc := newService(sender, logs, true)

	err := svc.Notify(context.Background(), nil, "0811", "invoice_issued", nil)
	require.Error(t, err)
	got := logs.get(1)
	assert.Equal(t, "failed", got.Status)
	assert.Equal(t, 1, got.RetryCount)
	require.NotNil(t, got.NextRetryAt)
	assert.True(t, got.NextRetryAt.After(fixedNow), "next_retry_at harus di masa depan")
}

func TestRender_MissingTemplate_Error(t *testing.T) {
	svc := newService(&fakeSender{}, newFakeLogs(), true)
	_, err := svc.Render(context.Background(), "tidak_ada", nil)
	assert.ErrorIs(t, err, store.ErrTemplateNotFound)
}

func TestNotify_EmptyPhone_Error(t *testing.T) {
	svc := newService(&fakeSender{}, newFakeLogs(), true)
	err := svc.Notify(context.Background(), nil, "", "invoice_issued", nil)
	assert.Error(t, err)
}

func TestRetryPending_ResendsFailed(t *testing.T) {
	sender := &fakeSender{err: errors.New("down")}
	logs := newFakeLogs()
	now := fixedNow
	settings := &fakeSettings{m: map[string]string{"notification.wa_enabled": "true"}}
	tpl := &fakeTemplates{m: map[string]model.MessageTemplate{
		"invoice_issued": {Slug: "invoice_issued", Body: "x", Active: true},
	}}
	svc := notification.New(notification.Deps{
		Sender: sender, Templates: tpl, Logs: logs, Settings: settings,
		NowFunc: func() time.Time { return now },
	})

	// Buat satu notifikasi gagal (next_retry_at = now + backoff).
	_ = svc.Notify(context.Background(), nil, "0811", "invoice_issued", nil)
	require.Equal(t, "failed", logs.get(1).Status)

	// Sender pulih + waktu maju melewati backoff → retry harus menandai sent.
	sender.mu.Lock()
	sender.err = nil
	sender.mu.Unlock()
	now = fixedNow.Add(30 * time.Minute)

	n, err := svc.RetryPending(context.Background(), 10)
	require.NoError(t, err)
	assert.Equal(t, 1, n)
	assert.Equal(t, "sent", logs.get(1).Status)
}
