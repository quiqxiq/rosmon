package store

import (
	"context"
	"errors"

	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrHotspotProfileNotFound = errors.New("store: hotspot profile not found")
	ErrHotspotProfileInUse    = errors.New("store: hotspot profile still referenced by subscription")
)

// HotspotProfileListFilter optional filter for ListByDevice.
type HotspotProfileListFilter struct {
	Role       string // 'permanent' | 'voucher' | "" (all)
	OnlyActive bool
}

type HotspotProfileStore interface {
	ListByDevice(ctx context.Context, deviceID uint, f HotspotProfileListFilter) ([]model.HotspotProfile, error)
	// ListPublic mengembalikan paket 'permanent' aktif yang ditandai publik
	// (lintas device), untuk form pendaftaran publik. Diurut by name.
	ListPublic(ctx context.Context) ([]model.HotspotProfile, error)
	Get(ctx context.Context, id uint) (model.HotspotProfile, error)
	GetByName(ctx context.Context, deviceID uint, name string) (model.HotspotProfile, error)
	Create(ctx context.Context, p *model.HotspotProfile) error
	Update(ctx context.Context, p *model.HotspotProfile) error
	Delete(ctx context.Context, id uint) error
	// Upsert INSERT-or-UPDATE by (device_id, name). role is only set on insert.
	Upsert(ctx context.Context, p *model.HotspotProfile) (created bool, err error)
}

type gormHotspotProfileStore struct{ db *gorm.DB }

func NewHotspotProfileStore(db *gorm.DB) HotspotProfileStore {
	return &gormHotspotProfileStore{db: db}
}

func (s *gormHotspotProfileStore) ListByDevice(ctx context.Context, deviceID uint, f HotspotProfileListFilter) ([]model.HotspotProfile, error) {
	q := s.db.WithContext(ctx).Where("device_id = ?", deviceID).Order("role, name")
	if f.Role != "" {
		q = q.Where("role = ?", f.Role)
	}
	if f.OnlyActive {
		q = q.Where("active = ?", true)
	}
	var out []model.HotspotProfile
	err := q.Find(&out).Error
	return out, err
}

func (s *gormHotspotProfileStore) ListPublic(ctx context.Context) ([]model.HotspotProfile, error) {
	var out []model.HotspotProfile
	err := s.db.WithContext(ctx).
		Where("is_public = ? AND active = ? AND role = ?", true, true, "permanent").
		Order("name").Find(&out).Error
	return out, err
}

func (s *gormHotspotProfileStore) Get(ctx context.Context, id uint) (model.HotspotProfile, error) {
	var p model.HotspotProfile
	err := s.db.WithContext(ctx).First(&p, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return p, ErrHotspotProfileNotFound
	}
	return p, err
}

func (s *gormHotspotProfileStore) GetByName(ctx context.Context, deviceID uint, name string) (model.HotspotProfile, error) {
	var p model.HotspotProfile
	err := s.db.WithContext(ctx).
		Where("device_id = ? AND name = ?", deviceID, name).
		First(&p).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return p, ErrHotspotProfileNotFound
	}
	return p, err
}

func (s *gormHotspotProfileStore) Create(ctx context.Context, p *model.HotspotProfile) error {
	return s.db.WithContext(ctx).Create(p).Error
}

func (s *gormHotspotProfileStore) Update(ctx context.Context, p *model.HotspotProfile) error {
	return s.db.WithContext(ctx).Save(p).Error
}

func (s *gormHotspotProfileStore) Delete(ctx context.Context, id uint) error {
	var count int64
	if err := s.db.WithContext(ctx).
		Model(&model.Subscription{}).
		Where("hotspot_profile_id = ?", id).
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return ErrHotspotProfileInUse
	}
	res := s.db.WithContext(ctx).Delete(&model.HotspotProfile{}, id)
	if res.Error != nil {
		if isFKViolation(res.Error) {
			return ErrHotspotProfileInUse
		}
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrHotspotProfileNotFound
	}
	return nil
}

// Upsert INSERT-or-UPDATE by (device_id, name).
// role is only set on INSERT — not overwritten on update.
// Preserves operator fields (price_monthly, expiry_mode, validity, etc.).
// Only syncs rate_limit and active from router.
func (s *gormHotspotProfileStore) Upsert(ctx context.Context, p *model.HotspotProfile) (created bool, err error) {
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing model.HotspotProfile
		lookupErr := tx.Where("device_id = ? AND name = ?", p.DeviceID, p.Name).First(&existing).Error
		created = errors.Is(lookupErr, gorm.ErrRecordNotFound)
		if lookupErr != nil && !created {
			return lookupErr
		}
		if !created {
			p.ID = existing.ID
			p.CreatedAt = existing.CreatedAt
			// Preserve role and operator-set fields.
			p.Role = existing.Role
			p.PriceMonthly = existing.PriceMonthly
			p.ExpiryMode = existing.ExpiryMode
			p.Validity = existing.Validity
			p.Price = existing.Price
			p.SellPrice = existing.SellPrice
			p.LockMAC = existing.LockMAC
			p.Description = existing.Description
			p.IsPublic = existing.IsPublic
		}
		return tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "device_id"}, {Name: "name"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"rate_limit", "address_pool", "shared_users", "status_autorefresh",
				"parent_queue", "active", "updated_at",
			}),
		}).Create(p).Error
	})
	return created, err
}
