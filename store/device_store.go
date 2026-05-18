package store

import (
	"context"
	"time"

	"github.com/quiqxiq/roslib-mikhmon/store/model"
	"gorm.io/gorm"
)

type DeviceStore interface {
	// List mengembalikan device dengan active=true. Dipakai bootstrap
	// service (devmgr.Start, expiry.Start, metrics.Start) yang hanya
	// ingin auto-connect ke device aktif.
	List(ctx context.Context) ([]model.MikrotikDevice, error)
	// ListAll mengembalikan SEMUA device (termasuk active=false).
	// Dipakai handler API & healthz supaya operator bisa melihat &
	// mengelola device yang sedang dinonaktifkan tanpa di-soft-delete.
	ListAll(ctx context.Context) ([]model.MikrotikDevice, error)
	Get(ctx context.Context, id uint) (model.MikrotikDevice, error)
	GetBySlug(ctx context.Context, slug string) (model.MikrotikDevice, error)
	Create(ctx context.Context, d *model.MikrotikDevice) error
	Update(ctx context.Context, d *model.MikrotikDevice) error
	Delete(ctx context.Context, id uint) error
	UpdateStatus(ctx context.Context, id uint, status, lastError string, lastSeen *time.Time) error
}

type gormDeviceStore struct{ db *gorm.DB }

func NewDeviceStore(db *gorm.DB) DeviceStore { return &gormDeviceStore{db: db} }

func (s *gormDeviceStore) List(ctx context.Context) ([]model.MikrotikDevice, error) {
	var ds []model.MikrotikDevice
	err := s.db.WithContext(ctx).Where("active = true").Find(&ds).Error
	return ds, err
}

func (s *gormDeviceStore) ListAll(ctx context.Context) ([]model.MikrotikDevice, error) {
	var ds []model.MikrotikDevice
	err := s.db.WithContext(ctx).Find(&ds).Error
	return ds, err
}

func (s *gormDeviceStore) Get(ctx context.Context, id uint) (model.MikrotikDevice, error) {
	var d model.MikrotikDevice
	err := s.db.WithContext(ctx).First(&d, id).Error
	return d, err
}

func (s *gormDeviceStore) GetBySlug(ctx context.Context, slug string) (model.MikrotikDevice, error) {
	var d model.MikrotikDevice
	err := s.db.WithContext(ctx).Where("slug = ?", slug).First(&d).Error
	return d, err
}

func (s *gormDeviceStore) Create(ctx context.Context, d *model.MikrotikDevice) error {
	return s.db.WithContext(ctx).Create(d).Error
}

func (s *gormDeviceStore) Update(ctx context.Context, d *model.MikrotikDevice) error {
	return s.db.WithContext(ctx).Save(d).Error
}

func (s *gormDeviceStore) Delete(ctx context.Context, id uint) error {
	return s.db.WithContext(ctx).Delete(&model.MikrotikDevice{}, id).Error
}

func (s *gormDeviceStore) UpdateStatus(ctx context.Context, id uint, status, lastError string, lastSeen *time.Time) error {
	return s.db.WithContext(ctx).Model(&model.MikrotikDevice{}).Where("id = ?", id).
		Updates(map[string]any{
			"status":     status,
			"last_error": lastError,
			"last_seen":  lastSeen,
		}).Error
}
