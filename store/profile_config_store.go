package store

import (
	"context"
	"errors"

	"github.com/quiqxiq/roslib-mikhmon/store/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ErrProfileConfigNotFound dikembalikan oleh GetByName / DeleteByName saat
// kombinasi (device_id, profile_name) tidak ditemukan. Berbeda dari Get()
// existing yang auto-default ke mode "rem" (untuk kompatibilitas expiry service).
var ErrProfileConfigNotFound = errors.New("store: profile config not found")

type ProfileConfigStore interface {
	// Get returns config; jika tidak ada, return default {ExpiryMode: "rem"}
	// — dipakai expiry service supaya behavior konsisten.
	Get(ctx context.Context, deviceID uint, profileName string) (model.HotspotProfileConfig, error)
	// GetByName strict lookup — return ErrProfileConfigNotFound jika tidak ada.
	GetByName(ctx context.Context, deviceID uint, profileName string) (model.HotspotProfileConfig, error)
	Upsert(ctx context.Context, cfg *model.HotspotProfileConfig) error
	// UpsertResult returns whether row di-insert (created=true) atau di-update (created=false).
	UpsertResult(ctx context.Context, cfg *model.HotspotProfileConfig) (created bool, err error)
	ListByDevice(ctx context.Context, deviceID uint) ([]model.HotspotProfileConfig, error)
	Delete(ctx context.Context, id uint) error
	DeleteByName(ctx context.Context, deviceID uint, profileName string) error
}

type gormProfileConfigStore struct{ db *gorm.DB }

func NewProfileConfigStore(db *gorm.DB) ProfileConfigStore {
	return &gormProfileConfigStore{db: db}
}

func (s *gormProfileConfigStore) Get(ctx context.Context, deviceID uint, profileName string) (model.HotspotProfileConfig, error) {
	var cfg model.HotspotProfileConfig
	err := s.db.WithContext(ctx).
		Where("device_id = ? AND profile_name = ?", deviceID, profileName).
		First(&cfg).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Default: mode "rem" (remove expired user)
		return model.HotspotProfileConfig{
			DeviceID:    deviceID,
			ProfileName: profileName,
			ExpiryMode:  "rem",
		}, nil
	}
	return cfg, err
}

func (s *gormProfileConfigStore) Upsert(ctx context.Context, cfg *model.HotspotProfileConfig) error {
	return s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "device_id"}, {Name: "profile_name"}},
			DoUpdates: clause.AssignmentColumns([]string{"expiry_mode", "validity", "price", "sell_price", "lock_mac", "updated_at"}),
		}).Create(cfg).Error
}

func (s *gormProfileConfigStore) ListByDevice(ctx context.Context, deviceID uint) ([]model.HotspotProfileConfig, error) {
	var cfgs []model.HotspotProfileConfig
	err := s.db.WithContext(ctx).Where("device_id = ?", deviceID).Find(&cfgs).Error
	return cfgs, err
}

func (s *gormProfileConfigStore) Delete(ctx context.Context, id uint) error {
	return s.db.WithContext(ctx).Delete(&model.HotspotProfileConfig{}, id).Error
}

func (s *gormProfileConfigStore) GetByName(ctx context.Context, deviceID uint, profileName string) (model.HotspotProfileConfig, error) {
	var cfg model.HotspotProfileConfig
	err := s.db.WithContext(ctx).
		Where("device_id = ? AND profile_name = ?", deviceID, profileName).
		First(&cfg).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return cfg, ErrProfileConfigNotFound
	}
	return cfg, err
}

func (s *gormProfileConfigStore) DeleteByName(ctx context.Context, deviceID uint, profileName string) error {
	res := s.db.WithContext(ctx).
		Where("device_id = ? AND profile_name = ?", deviceID, profileName).
		Delete(&model.HotspotProfileConfig{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrProfileConfigNotFound
	}
	return nil
}

// UpsertResult — return created=true bila record baru di-INSERT, false kalau UPDATE.
// Seluruh SELECT + Upsert dibungkus dalam satu transaksi untuk menghindari
// TOCTOU race: dua request concurrent tidak akan sama-sama INSERT row baru.
func (s *gormProfileConfigStore) UpsertResult(ctx context.Context, cfg *model.HotspotProfileConfig) (created bool, err error) {
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing model.HotspotProfileConfig
		lookupErr := tx.
			Where("device_id = ? AND profile_name = ?", cfg.DeviceID, cfg.ProfileName).
			First(&existing).Error
		created = errors.Is(lookupErr, gorm.ErrRecordNotFound)
		if lookupErr != nil && !created {
			return lookupErr
		}
		if !created {
			cfg.ID = existing.ID
			cfg.CreatedAt = existing.CreatedAt
		}
		// Gunakan tx (bukan s.db) supaya Upsert berada dalam transaksi yang sama.
		return tx.
			Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "device_id"}, {Name: "profile_name"}},
				DoUpdates: clause.AssignmentColumns([]string{"expiry_mode", "validity", "price", "sell_price", "lock_mac", "updated_at"}),
			}).Create(cfg).Error
	})
	return created, err
}
