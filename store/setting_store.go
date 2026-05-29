package store

import (
	"context"
	"errors"
	"time"

	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
)

var ErrSettingNotFound = errors.New("store: setting not found")

type SettingStore interface {
	Get(ctx context.Context, key string) (string, error)
	Set(ctx context.Context, key, value string) error
	List(ctx context.Context) ([]model.SystemSetting, error)
}

type gormSettingStore struct{ db *gorm.DB }

func NewSettingStore(db *gorm.DB) SettingStore {
	return &gormSettingStore{db: db}
}

func (s *gormSettingStore) Get(ctx context.Context, key string) (string, error) {
	var setting model.SystemSetting
	err := s.db.WithContext(ctx).Where("key = ?", key).First(&setting).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", ErrSettingNotFound
	}
	if err != nil {
		return "", err
	}
	return setting.Value, nil
}

func (s *gormSettingStore) Set(ctx context.Context, key, value string) error {
	res := s.db.WithContext(ctx).Model(&model.SystemSetting{}).
		Where("key = ?", key).
		Updates(map[string]any{"value": value, "updated_at": time.Now()})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrSettingNotFound
	}
	return nil
}

func (s *gormSettingStore) List(ctx context.Context) ([]model.SystemSetting, error) {
	var out []model.SystemSetting
	err := s.db.WithContext(ctx).Order("group_name, key").Find(&out).Error
	return out, err
}
