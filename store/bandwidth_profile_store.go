package store

import (
	"context"
	"errors"
	"strings"

	"github.com/quiqxiq/roslib-mikhmon/store/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrBandwidthProfileNotFound = errors.New("store: bandwidth profile not found")
	// ErrBandwidthProfileInUse — masih ada subscription yang reference profile ini.
	// Caller harus terminate subscription dulu sebelum DELETE.
	ErrBandwidthProfileInUse = errors.New("store: bandwidth profile still referenced by subscription")
)

// BandwidthProfileListFilter optional filter untuk List.
type BandwidthProfileListFilter struct {
	ServiceType string // 'pppoe' | 'hotspot' | "" (all)
	OnlyActive  bool
}

type BandwidthProfileStore interface {
	ListByDevice(ctx context.Context, deviceID uint, f BandwidthProfileListFilter) ([]model.BandwidthProfile, error)
	Get(ctx context.Context, id uint) (model.BandwidthProfile, error)
	GetByMikrotikName(ctx context.Context, deviceID uint, serviceType, profileName string) (model.BandwidthProfile, error)
	Create(ctx context.Context, p *model.BandwidthProfile) error
	Update(ctx context.Context, p *model.BandwidthProfile) error
	Delete(ctx context.Context, id uint) error
	// UpsertResult INSERT atau UPDATE berdasarkan compound key
	// (device_id, service_type, mikrotik_profile_name). Return created=true
	// kalau row baru di-insert. Dipakai oleh Sync endpoint.
	UpsertResult(ctx context.Context, p *model.BandwidthProfile) (created bool, err error)
}

type gormBandwidthProfileStore struct{ db *gorm.DB }

func NewBandwidthProfileStore(db *gorm.DB) BandwidthProfileStore {
	return &gormBandwidthProfileStore{db: db}
}

func (s *gormBandwidthProfileStore) ListByDevice(ctx context.Context, deviceID uint, f BandwidthProfileListFilter) ([]model.BandwidthProfile, error) {
	q := s.db.WithContext(ctx).Where("device_id = ?", deviceID).Order("service_type, name")
	if f.ServiceType != "" {
		q = q.Where("service_type = ?", f.ServiceType)
	}
	if f.OnlyActive {
		q = q.Where("active = ?", true)
	}
	var out []model.BandwidthProfile
	err := q.Find(&out).Error
	return out, err
}

func (s *gormBandwidthProfileStore) Get(ctx context.Context, id uint) (model.BandwidthProfile, error) {
	var p model.BandwidthProfile
	err := s.db.WithContext(ctx).First(&p, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return p, ErrBandwidthProfileNotFound
	}
	return p, err
}

func (s *gormBandwidthProfileStore) GetByMikrotikName(ctx context.Context, deviceID uint, serviceType, profileName string) (model.BandwidthProfile, error) {
	var p model.BandwidthProfile
	err := s.db.WithContext(ctx).
		Where("device_id = ? AND service_type = ? AND mikrotik_profile_name = ?", deviceID, serviceType, profileName).
		First(&p).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return p, ErrBandwidthProfileNotFound
	}
	return p, err
}

func (s *gormBandwidthProfileStore) Create(ctx context.Context, p *model.BandwidthProfile) error {
	return s.db.WithContext(ctx).Create(p).Error
}

func (s *gormBandwidthProfileStore) Update(ctx context.Context, p *model.BandwidthProfile) error {
	return s.db.WithContext(ctx).Save(p).Error
}

func (s *gormBandwidthProfileStore) Delete(ctx context.Context, id uint) error {
	// App-level in-use guard. FK RESTRICT di DB tidak efektif karena
	// Subscription pakai soft-delete (row tetap ada saat "delete"). Cek
	// subscription aktif (belum di-soft-delete) yang reference profile ini.
	var count int64
	if err := s.db.WithContext(ctx).
		Model(&model.Subscription{}).
		Where("bandwidth_profile_id = ?", id).
		Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return ErrBandwidthProfileInUse
	}
	res := s.db.WithContext(ctx).Delete(&model.BandwidthProfile{}, id)
	if res.Error != nil {
		if isFKViolation(res.Error) {
			return ErrBandwidthProfileInUse
		}
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrBandwidthProfileNotFound
	}
	return nil
}

// UpsertResult — transactional INSERT-or-UPDATE pada compound key.
// Field yang di-overwrite saat conflict: name, rate_limit, price_monthly,
// description, active, updated_at. ID + DeviceID + ServiceType +
// MikrotikProfileName tidak boleh berubah karena adalah natural key.
func (s *gormBandwidthProfileStore) UpsertResult(ctx context.Context, p *model.BandwidthProfile) (created bool, err error) {
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing model.BandwidthProfile
		lookupErr := tx.
			Where("device_id = ? AND service_type = ? AND mikrotik_profile_name = ?",
				p.DeviceID, p.ServiceType, p.MikrotikProfileName).
			First(&existing).Error
		created = errors.Is(lookupErr, gorm.ErrRecordNotFound)
		if lookupErr != nil && !created {
			return lookupErr
		}
		if !created {
			p.ID = existing.ID
			p.CreatedAt = existing.CreatedAt
		}
		return tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "device_id"}, {Name: "service_type"}, {Name: "mikrotik_profile_name"},
			},
			DoUpdates: clause.AssignmentColumns([]string{
				"name", "rate_limit", "price_monthly", "description", "active", "updated_at",
			}),
		}).Create(p).Error
	})
	return created, err
}

// isFKViolation deteksi foreign-key violation generik (PostgreSQL + SQLite).
func isFKViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "foreign key") || strings.Contains(msg, "violates foreign key constraint")
}
