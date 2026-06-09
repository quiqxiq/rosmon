package store

import (
	"context"
	"errors"

	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrQuickPrintNotFound = errors.New("store: quick print package not found")

// QuickPrintStore mengelola preset Quick Print per-device (DB-backed).
type QuickPrintStore interface {
	ListByDevice(ctx context.Context, deviceID uint) ([]model.QuickPrintPackage, error)
	GetByName(ctx context.Context, deviceID uint, name string) (model.QuickPrintPackage, error)
	// Upsert INSERT-or-UPDATE by (device_id, name).
	Upsert(ctx context.Context, p *model.QuickPrintPackage) (created bool, err error)
	// Update menyimpan record berdasarkan ID (dipakai untuk rename — Name boleh berubah).
	Update(ctx context.Context, p *model.QuickPrintPackage) error
	DeleteByName(ctx context.Context, deviceID uint, name string) error
}

type gormQuickPrintStore struct{ db *gorm.DB }

func NewQuickPrintStore(db *gorm.DB) QuickPrintStore {
	return &gormQuickPrintStore{db: db}
}

func (s *gormQuickPrintStore) ListByDevice(ctx context.Context, deviceID uint) ([]model.QuickPrintPackage, error) {
	var out []model.QuickPrintPackage
	err := s.db.WithContext(ctx).
		Where("device_id = ?", deviceID).
		Order("name").Find(&out).Error
	return out, err
}

func (s *gormQuickPrintStore) GetByName(ctx context.Context, deviceID uint, name string) (model.QuickPrintPackage, error) {
	var p model.QuickPrintPackage
	err := s.db.WithContext(ctx).
		Where("device_id = ? AND name = ?", deviceID, name).
		First(&p).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return p, ErrQuickPrintNotFound
	}
	return p, err
}

func (s *gormQuickPrintStore) Upsert(ctx context.Context, p *model.QuickPrintPackage) (created bool, err error) {
	err = s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing model.QuickPrintPackage
		lookupErr := tx.Where("device_id = ? AND name = ?", p.DeviceID, p.Name).First(&existing).Error
		created = errors.Is(lookupErr, gorm.ErrRecordNotFound)
		if lookupErr != nil && !created {
			return lookupErr
		}
		if !created {
			p.ID = existing.ID
			p.CreatedAt = existing.CreatedAt
		}
		return tx.Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "device_id"}, {Name: "name"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"server", "user_mode", "user_length", "prefix", "char_mode",
				"profile", "time_limit", "data_limit", "comment", "validity",
				"price", "selling_price", "lock_user", "updated_at",
			}),
		}).Create(p).Error
	})
	return created, err
}

func (s *gormQuickPrintStore) Update(ctx context.Context, p *model.QuickPrintPackage) error {
	return s.db.WithContext(ctx).Save(p).Error
}

func (s *gormQuickPrintStore) DeleteByName(ctx context.Context, deviceID uint, name string) error {
	res := s.db.WithContext(ctx).
		Where("device_id = ? AND name = ?", deviceID, name).
		Delete(&model.QuickPrintPackage{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrQuickPrintNotFound
	}
	return nil
}
