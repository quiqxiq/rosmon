package notification

import (
	"context"
	"fmt"
	"strings"
	"text/template"
	"time"

	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
)

// retryBackoff adalah jeda sebelum notifikasi gagal dicoba ulang oleh
// job/notif_retry.
const retryBackoff = 10 * time.Minute

// Deps adalah dependency Service. NowFunc injectable untuk test.
type Deps struct {
	Sender    Sender
	Templates store.TemplateStore
	Logs      store.NotificationLogStore
	Settings  store.SettingStore
	Log       *logrus.Logger
	NowFunc   func() time.Time
}

// Service merender template + mengirim notifikasi + menulis jejak.
type Service struct {
	d Deps
}

func New(d Deps) *Service {
	if d.NowFunc == nil {
		d.NowFunc = time.Now
	}
	if d.Log == nil {
		d.Log = logrus.New()
	}
	if d.Sender == nil {
		d.Sender = NoopSender{}
	}
	return &Service{d: d}
}

// enabled membaca toggle notification.wa_enabled dari system_settings.
// Default false (fail-safe: jangan kirim kalau ragu).
func (s *Service) enabled(ctx context.Context) bool {
	if s.d.Settings == nil {
		return false
	}
	v, err := s.d.Settings.Get(ctx, "notification.wa_enabled")
	if err != nil {
		return false
	}
	return v == "true" || v == "1"
}

// Render merender body template (text/template) dengan vars. missingkey=zero
// supaya variabel yang tidak diisi tidak menggagalkan render.
func (s *Service) Render(ctx context.Context, slug string, vars map[string]string) (string, error) {
	tpl, err := s.d.Templates.GetBySlug(ctx, slug)
	if err != nil {
		return "", err
	}
	t, err := template.New(slug).Option("missingkey=zero").Parse(tpl.Body)
	if err != nil {
		return "", fmt.Errorf("notification: parse template %s: %w", slug, err)
	}
	var sb strings.Builder
	if err := t.Execute(&sb, vars); err != nil {
		return "", fmt.Errorf("notification: execute template %s: %w", slug, err)
	}
	return sb.String(), nil
}

// Notify merender slug, menulis notification_log, lalu mengirim. customerID
// nil = penerima non-pelanggan (mis. admin). Jejak SELALU ditulis (sukses,
// gagal, atau skipped). Gagal kirim → status failed + next_retry_at.
func (s *Service) Notify(ctx context.Context, customerID *uint, phone, slug string, vars map[string]string) error {
	if phone == "" {
		return fmt.Errorf("notification: empty recipient phone for %s", slug)
	}
	body, err := s.Render(ctx, slug, vars)
	if err != nil {
		return err
	}

	entry := &model.NotificationLog{
		CustomerID:     customerID,
		TemplateSlug:   slug,
		RecipientPhone: phone,
		MessageBody:    body,
		Provider:       s.d.Sender.Name(),
	}

	// WhatsApp dimatikan → catat skipped & berhenti (bukan error).
	if !s.enabled(ctx) {
		entry.Status = "skipped"
		if err := s.d.Logs.Create(ctx, entry); err != nil {
			s.d.Log.WithError(err).Warn("notification: write skipped log failed")
		}
		return nil
	}

	entry.Status = "pending"
	if err := s.d.Logs.Create(ctx, entry); err != nil {
		return fmt.Errorf("notification: write log: %w", err)
	}

	resp, sendErr := s.d.Sender.Send(ctx, phone, body)
	now := s.d.NowFunc()
	if sendErr != nil {
		if e := s.d.Logs.MarkFailed(ctx, entry.ID, sendErr.Error(), now.Add(retryBackoff)); e != nil {
			s.d.Log.WithError(e).Warn("notification: mark failed error")
		}
		return sendErr
	}
	if e := s.d.Logs.MarkSent(ctx, entry.ID, resp, now); e != nil {
		s.d.Log.WithError(e).Warn("notification: mark sent error")
	}
	return nil
}

// NotifyAsync menjalankan Notify di background (best-effort). Dipakai dari job
// & handler agar tidak memblok response.
func (s *Service) NotifyAsync(customerID *uint, phone, slug string, vars map[string]string) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		if err := s.Notify(ctx, customerID, phone, slug, vars); err != nil {
			s.d.Log.WithError(err).WithField("slug", slug).Warn("notification: async notify failed")
		}
	}()
}

// RetryPending mengirim ulang notifikasi status=failed yang sudah waktunya
// retry. Dipanggil oleh job/notif_retry. Idempotent. Mengembalikan jumlah
// yang berhasil terkirim.
func (s *Service) RetryPending(ctx context.Context, limit int) (int, error) {
	pending, err := s.d.Logs.ListPendingRetry(ctx, s.d.NowFunc(), limit)
	if err != nil {
		return 0, err
	}
	sent := 0
	for _, l := range pending {
		select {
		case <-ctx.Done():
			return sent, ctx.Err()
		default:
		}
		resp, sendErr := s.d.Sender.Send(ctx, l.RecipientPhone, l.MessageBody)
		now := s.d.NowFunc()
		if sendErr != nil {
			_ = s.d.Logs.MarkFailed(ctx, l.ID, sendErr.Error(), now.Add(retryBackoff))
			continue
		}
		_ = s.d.Logs.MarkSent(ctx, l.ID, resp, now)
		sent++
	}
	return sent, nil
}
