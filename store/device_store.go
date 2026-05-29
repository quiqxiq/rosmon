package store

import (
	"context"
	"time"

	"github.com/quiqxiq/rosmon/store/model"
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
	Create(ctx context.Context, d *model.MikrotikDevice) error
	Update(ctx context.Context, d *model.MikrotikDevice) error
	Delete(ctx context.Context, id uint) error
	UpdateStatus(ctx context.Context, id uint, status, lastError string, lastSeen *time.Time) error
	UpdateTimezone(ctx context.Context, id uint, tz string) error
}

type gormDeviceStore struct{ db *gorm.DB }

func NewDeviceStore(db *gorm.DB) DeviceStore { return &gormDeviceStore{db: db} }

// decryptPasswords mendekripsi field Password pada setiap device di slice.
func decryptPasswords(ds []model.MikrotikDevice) ([]model.MikrotikDevice, error) {
	for i := range ds {
		p, err := decryptDevicePassword(ds[i].Password)
		if err != nil {
			return nil, err
		}
		ds[i].Password = p
	}
	return ds, nil
}

func (s *gormDeviceStore) List(ctx context.Context) ([]model.MikrotikDevice, error) {
	var ds []model.MikrotikDevice
	if err := s.db.WithContext(ctx).Where("active = true").Find(&ds).Error; err != nil {
		return nil, err
	}
	return decryptPasswords(ds)
}

func (s *gormDeviceStore) ListAll(ctx context.Context) ([]model.MikrotikDevice, error) {
	var ds []model.MikrotikDevice
	if err := s.db.WithContext(ctx).Find(&ds).Error; err != nil {
		return nil, err
	}
	return decryptPasswords(ds)
}

func (s *gormDeviceStore) Get(ctx context.Context, id uint) (model.MikrotikDevice, error) {
	var d model.MikrotikDevice
	if err := s.db.WithContext(ctx).First(&d, id).Error; err != nil {
		return d, err
	}
	p, err := decryptDevicePassword(d.Password)
	if err != nil {
		return d, err
	}
	d.Password = p
	return d, nil
}

func (s *gormDeviceStore) Create(ctx context.Context, d *model.MikrotikDevice) error {
	enc, err := encryptDevicePassword(d.Password)
	if err != nil {
		return err
	}
	// Simpan ke DB dengan password terenkripsi; restore plaintext di struct
	// supaya caller (devmgr.Add) masih dapat password asli.
	orig := d.Password
	d.Password = enc
	if err := s.db.WithContext(ctx).Create(d).Error; err != nil {
		d.Password = orig
		return err
	}
	d.Password = orig
	return nil
}

func (s *gormDeviceStore) Update(ctx context.Context, d *model.MikrotikDevice) error {
	enc, err := encryptDevicePassword(d.Password)
	if err != nil {
		return err
	}
	orig := d.Password
	d.Password = enc
	err = s.db.WithContext(ctx).Model(d).Updates(d).Error
	d.Password = orig
	return err
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

func (s *gormDeviceStore) UpdateTimezone(ctx context.Context, id uint, tz string) error {
	return s.db.WithContext(ctx).Model(&model.MikrotikDevice{}).Where("id = ?", id).
		Update("time_zone", tz).Error
}
