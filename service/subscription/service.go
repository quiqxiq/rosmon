// Package subscription menyediakan business logic untuk manajemen subscription:
// resolusi profile, transisi status, dan wiring ke outbox/audit.
// Handler di api/handler/subscriptions.go menjadi tipis — hanya parse request
// dan serialize response, business logic ada di sini.
package subscription

import (
	"context"
	"fmt"
	"time"

	"github.com/quiqxiq/rosmon/service/audit"
	"github.com/quiqxiq/rosmon/service/notification"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
)

// subStatusUpdater adalah subset kecil dari store.SubscriptionStore
// yang dibutuhkan oleh SetStatus. Didefinisikan di sini agar test dapat
// mock tanpa harus mengimplementasikan seluruh interface store.
type subStatusUpdater interface {
	UpdateStatus(ctx context.Context, id uint, status string, activatedAt, terminatedAt *time.Time) error
}

// pppProfileGetter adalah subset store.PPPProfileStore.
type pppProfileGetter interface {
	Get(ctx context.Context, id uint) (model.PPPProfile, error)
}

// hotspotProfileGetter adalah subset store.HotspotProfileStore.
type hotspotProfileGetter interface {
	Get(ctx context.Context, id uint) (model.HotspotProfile, error)
}

// settingGetter adalah subset store.SettingStore.
type settingGetter interface {
	Get(ctx context.Context, key string) (string, error)
}

// Deps adalah dependency injection container untuk Service.
type Deps struct {
	Subs     subStatusUpdater
	PPP      pppProfileGetter
	Hotspot  hotspotProfileGetter
	Settings settingGetter
	Audit    store.AuditLogStore
	Notif    *notification.Service
	Log      *logrus.Logger
	NowFunc  func() time.Time // injectable untuk test; nil = time.Now
}

// Service menyediakan operasi business logic subscription.
type Service struct {
	d Deps
}

// New membuat Service baru. NowFunc nil akan diisi time.Now secara otomatis.
func New(d Deps) *Service {
	if d.NowFunc == nil {
		d.NowFunc = time.Now
	}
	if d.Log == nil {
		d.Log = logrus.New()
	}
	return &Service{d: d}
}

// ResolveProfile mengembalikan (profileName, disabled) yang tepat untuk
// status subscription yang diberikan. Logika ini sebelumnya inline di
// api/handler/subscriptions.go#resolveProfileForSub.
func (s *Service) ResolveProfile(ctx context.Context, sub model.Subscription, status string) (profileName string, disabled bool) {
	normalProfile := ""
	isolirProfile := "isolir"

	switch sub.ServiceType {
	case "pppoe":
		if sub.PPPProfileID != nil && s.d.PPP != nil {
			if p, err := s.d.PPP.Get(ctx, *sub.PPPProfileID); err == nil {
				normalProfile = p.Name
			}
		}
	case "hotspot":
		if sub.HotspotProfileID != nil && s.d.Hotspot != nil {
			if p, err := s.d.Hotspot.Get(ctx, *sub.HotspotProfileID); err == nil {
				normalProfile = p.Name
			}
		}
	}
	if s.d.Settings != nil {
		if v, err := s.d.Settings.Get(ctx, "billing.isolir_profile_name"); err == nil && v != "" {
			isolirProfile = v
		}
	}
	return profileForStatus(status, normalProfile, isolirProfile)
}

// SetStatus mengubah status subscription di DB, mencatat audit log, dan
// (opsional) mengirim notifikasi ke pelanggan.
// Caller bertanggung jawab melakukan sync ke MikroTik (via outbox atau inline).
func (s *Service) SetStatus(ctx context.Context, sub *model.Subscription, newStatus string, byUserID *uint) error {
	prevStatus := sub.Status
	var activatedAt, terminatedAt *time.Time
	now := s.d.NowFunc()
	switch newStatus {
	case "active":
		if sub.ActivatedAt == nil {
			activatedAt = &now
		}
	case "terminated":
		terminatedAt = &now
	}
	if err := s.d.Subs.UpdateStatus(ctx, sub.ID, newStatus, activatedAt, terminatedAt); err != nil {
		return fmt.Errorf("update subscription status: %w", err)
	}
	sub.Status = newStatus
	if activatedAt != nil {
		sub.ActivatedAt = activatedAt
	}
	if terminatedAt != nil {
		sub.TerminatedAt = terminatedAt
	}

	audit.Log(ctx, s.d.Audit, s.d.Log, byUserID, "subscription_status_changed", "subscription", sub.ID,
		map[string]string{"status": prevStatus}, map[string]string{"status": newStatus})

	return nil
}

// IsolateSetting membaca nama profile isolir dari system_settings.
func (s *Service) IsolateSetting(ctx context.Context) string {
	if s.d.Settings != nil {
		if v, err := s.d.Settings.Get(ctx, "billing.isolir_profile_name"); err == nil && v != "" {
			return v
		}
	}
	return "isolir"
}

// profileForStatus mengembalikan (profileName, disabled) sesuai status.
func profileForStatus(status, normalProfile, isolirProfile string) (string, bool) {
	switch status {
	case "active":
		return normalProfile, false
	case "isolir":
		return isolirProfile, false
	case "suspended":
		return normalProfile, true
	default:
		return normalProfile, true
	}
}
