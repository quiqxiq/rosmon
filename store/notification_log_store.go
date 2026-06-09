package store

import (
	"context"
	"errors"
	"time"

	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
)

var ErrNotificationLogNotFound = errors.New("store: notification log not found")

// NotificationLogFilter filter opsional untuk List.
type NotificationLogFilter struct {
	CustomerID   *uint
	Status       string
	TemplateSlug string
	Limit        int
}

// NotificationLogStore membungkus penulisan jejak pengiriman notifikasi.
// Caller men-set Status saat Create ('pending' atau 'skipped'); MarkSent /
// MarkFailed dipakai setelah upaya kirim.
type NotificationLogStore interface {
	Create(ctx context.Context, l *model.NotificationLog) error
	MarkSent(ctx context.Context, id uint, providerResp string, sentAt time.Time) error
	MarkFailed(ctx context.Context, id uint, providerResp string, nextRetry time.Time) error
	// ListPendingRetry mengembalikan log status='failed' yang next_retry_at <= now.
	ListPendingRetry(ctx context.Context, now time.Time, limit int) ([]model.NotificationLog, error)
	List(ctx context.Context, f NotificationLogFilter) ([]model.NotificationLog, error)
}

type gormNotificationLogStore struct{ db *gorm.DB }

func NewNotificationLogStore(db *gorm.DB) NotificationLogStore {
	return &gormNotificationLogStore{db: db}
}

func (s *gormNotificationLogStore) Create(ctx context.Context, l *model.NotificationLog) error {
	if l.Status == "" {
		l.Status = "pending"
	}
	return s.db.WithContext(ctx).Create(l).Error
}

func (s *gormNotificationLogStore) MarkSent(ctx context.Context, id uint, providerResp string, sentAt time.Time) error {
	res := s.db.WithContext(ctx).Model(&model.NotificationLog{}).Where("id = ?", id).
		Updates(map[string]any{
			"status":            "sent",
			"provider_response": providerResp,
			"sent_at":           sentAt,
			"next_retry_at":     nil,
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrNotificationLogNotFound
	}
	return nil
}

func (s *gormNotificationLogStore) MarkFailed(ctx context.Context, id uint, providerResp string, nextRetry time.Time) error {
	res := s.db.WithContext(ctx).Model(&model.NotificationLog{}).Where("id = ?", id).
		Updates(map[string]any{
			"status":            "failed",
			"provider_response": providerResp,
			"next_retry_at":     nextRetry,
			"retry_count":       gorm.Expr("retry_count + 1"),
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrNotificationLogNotFound
	}
	return nil
}

func (s *gormNotificationLogStore) ListPendingRetry(ctx context.Context, now time.Time, limit int) ([]model.NotificationLog, error) {
	if limit <= 0 {
		limit = 50
	}
	var out []model.NotificationLog
	err := s.db.WithContext(ctx).
		Where("status = ? AND (next_retry_at IS NULL OR next_retry_at <= ?)", "failed", now).
		Order("next_retry_at ASC").
		Limit(limit).
		Find(&out).Error
	return out, err
}

func (s *gormNotificationLogStore) List(ctx context.Context, f NotificationLogFilter) ([]model.NotificationLog, error) {
	q := s.db.WithContext(ctx).Order("created_at DESC")
	if f.CustomerID != nil {
		q = q.Where("customer_id = ?", *f.CustomerID)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.TemplateSlug != "" {
		q = q.Where("template_slug = ?", f.TemplateSlug)
	}
	limit := f.Limit
	switch {
	case limit <= 0:
		limit = 100
	case limit > 500:
		limit = 500
	}
	var out []model.NotificationLog
	return out, q.Limit(limit).Find(&out).Error
}
