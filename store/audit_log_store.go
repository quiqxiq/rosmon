package store

import (
	"context"

	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
)

// AuditLogFilter filter opsional untuk List. Field kosong = tidak filter pada
// kolom tersebut. Limit membatasi jumlah baris (default 100, max 500).
type AuditLogFilter struct {
	EntityType string
	EntityID   *uint
	Action     string
	UserID     *uint
	Limit      int
}

// AuditLogStore membungkus penulisan & pembacaan model.AuditLog.
type AuditLogStore interface {
	Create(ctx context.Context, e *model.AuditLog) error
	List(ctx context.Context, f AuditLogFilter) ([]model.AuditLog, error)
}

type gormAuditLogStore struct{ db *gorm.DB }

func NewAuditLogStore(db *gorm.DB) AuditLogStore { return &gormAuditLogStore{db: db} }

func (s *gormAuditLogStore) Create(ctx context.Context, e *model.AuditLog) error {
	return s.db.WithContext(ctx).Create(e).Error
}

func (s *gormAuditLogStore) List(ctx context.Context, f AuditLogFilter) ([]model.AuditLog, error) {
	q := s.db.WithContext(ctx).Order("created_at DESC")
	if f.EntityType != "" {
		q = q.Where("entity_type = ?", f.EntityType)
	}
	if f.EntityID != nil {
		q = q.Where("entity_id = ?", *f.EntityID)
	}
	if f.Action != "" {
		q = q.Where("action = ?", f.Action)
	}
	if f.UserID != nil {
		q = q.Where("user_id = ?", *f.UserID)
	}
	limit := f.Limit
	switch {
	case limit <= 0:
		limit = 100
	case limit > 500:
		limit = 500
	}
	var out []model.AuditLog
	return out, q.Limit(limit).Find(&out).Error
}
