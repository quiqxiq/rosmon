package store

import (
	"context"
	"errors"
	"time"

	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
)

var ErrTemplateNotFound = errors.New("store: message template not found")

// TemplateStore membungkus CRUD model.MessageTemplate. Template di-seed saat
// Migrate; admin hanya boleh edit body/name/active (slug immutable).
type TemplateStore interface {
	GetBySlug(ctx context.Context, slug string) (model.MessageTemplate, error)
	List(ctx context.Context) ([]model.MessageTemplate, error)
	Update(ctx context.Context, t *model.MessageTemplate) error
}

type gormTemplateStore struct{ db *gorm.DB }

func NewTemplateStore(db *gorm.DB) TemplateStore { return &gormTemplateStore{db: db} }

func (s *gormTemplateStore) GetBySlug(ctx context.Context, slug string) (model.MessageTemplate, error) {
	var t model.MessageTemplate
	err := s.db.WithContext(ctx).Where("slug = ?", slug).First(&t).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return t, ErrTemplateNotFound
	}
	return t, err
}

func (s *gormTemplateStore) List(ctx context.Context) ([]model.MessageTemplate, error) {
	var out []model.MessageTemplate
	err := s.db.WithContext(ctx).Order("slug").Find(&out).Error
	return out, err
}

func (s *gormTemplateStore) Update(ctx context.Context, t *model.MessageTemplate) error {
	res := s.db.WithContext(ctx).Model(&model.MessageTemplate{}).
		Where("slug = ?", t.Slug).
		Updates(map[string]any{
			"name":       t.Name,
			"body":       t.Body,
			"variables":  t.Variables,
			"active":     t.Active,
			"updated_at": time.Now(),
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrTemplateNotFound
	}
	return nil
}
