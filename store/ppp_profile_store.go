package store

import (
	"context"
	"errors"

	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrPPPProfileNotFound = errors.New("store: ppp profile not found")
	ErrPPPProfileInUse    = errors.New("store: ppp profile still referenced by subscription")
)

type PPPProfileStore interface {
	ListByDevice(ctx context.Context, deviceID uint) ([]model.PPPProfile, error)
	// ListPublic mengembalikan paket aktif yang ditandai publik (lintas device),
	// untuk form pendaftaran publik. Diurut by name.
	ListPublic(ctx context.Context) ([]model.PPPProfile, error)
	Get(ctx context.Context, id uint) (model.PPPProfile, error)
	GetByName(ctx context.Context, deviceID uint, name string) (model.PPPProfile, error)
	Create(ctx context.Context, p *model.PPPProfile) error
	Update(ctx context.Context, p *model.PPPProfile) error
	Delete(ctx context.Context, id uint) error
	// Upsert INSERT-or-UPDATE by (device_id, name). Returns created=true on insert.
	Upsert(ctx context.Context, p *model.PPPProfile) (created bool, err error)
}

type gormPPPProfileStore struct{ db *gorm.DB }

func NewPPPProfileStore(db *gorm.DB) PPPProfileStore {
	return &gormPPPProfileStore{db: db}
}

func (s *gormPPPProfileStore) ListByDevice(ctx context.Context, deviceID uint) ([]model.PPPProfile, error) {
	var out []model.PPPProfile
	err := s.db.WithContext(ctx).Where("device_id = ?", deviceID).Order("name").Find(&out).Error
	return out, err
}

func (s *gormPPPProfileStore) ListPublic(ctx context.Context) ([]model.PPPProfile, error) {
	var out []model.PPPProfile
	err := s.db.WithContext(ctx).
		Where("is_public = ? AND active = ?", true, true).
		Order("name").Find(&out).Error
	return out, err
}

func (s *gormPPPProfileStore) Get(ctx context.Context, id uint) (model.PPPProfile, error) {
	var p model.PPPProfile
	err := s.db.WithContext(ctx).First(&p, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return p, ErrPPPProfileNotFound
	}
	return p, err
}

func (s *gormPPPProfileStore) GetByName(ctx context.Context, deviceID uint, name string) (model.PPPProfile, error) {
	var p model.PPPProfile
	err := s.db.WithContext(ctx).
		Where("device_id = ? AND name = ?", deviceID, name).
		First(&p).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return p, ErrPPPProfileNotFound
	}
	return p, err
}

func (s *gormPPPProfileStore) Create(ctx context.Context, p *model.PPPProfile) error {
	return s.db.WithContext(ctx).Create(p).Error
}

func (s *gormPPPProfileStore) Update(ctx context.Context, p *model.PPPProfile) error {
	return s.db.WithContext(ctx).Save(p).Error
}

func (s *gormPPPProfileStore) Delete(ctx context.Context, id uint) error {
	var count int64
	if err := s.db.WithContext(ctx).
		Model(&model.Subscription{}).
		Where("ppp_profile_id = ?", id).
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return ErrPPPProfileInUse
	}
	res := s.db.WithContext(ctx).Delete(&model.PPPProfile{}, id)
	if res.Error != nil {
		if isFKViolation(res.Error) {
			return ErrPPPProfileInUse
		}
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrPPPProfileNotFound
	}
	return nil
}

// Upsert INSERT-or-UPDATE by (device_id, name).
// Preserves operator fields (price_monthly, description) on update — only
// syncs rate_limit and active from router.
func (s *gormPPPProfileStore) Upsert(ctx context.Context, p *model.PPPProfile) (created bool, err error) {
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing model.PPPProfile
		lookupErr := tx.Where("device_id = ? AND name = ?", p.DeviceID, p.Name).First(&existing).Error
		created = errors.Is(lookupErr, gorm.ErrRecordNotFound)
		if lookupErr != nil && !created {
			return lookupErr
		}
		if !created {
			p.ID = existing.ID
			p.CreatedAt = existing.CreatedAt
			// Preserve operator-set fields.
			p.PriceMonthly = existing.PriceMonthly
			p.Description = existing.Description
			p.IsPublic = existing.IsPublic
		}
		return tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "device_id"}, {Name: "name"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"rate_limit", "local_address", "remote_address", "session_timeout",
				"idle_timeout", "parent_queue", "active", "updated_at",
			}),
		}).Create(p).Error
	})
	return created, err
}
