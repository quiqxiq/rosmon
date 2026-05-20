package store

import (
	"context"
	"errors"

	"github.com/quiqxiq/roslib-mikhmon/store/model"
	"gorm.io/gorm"
)

// ErrUserNotFound dikembalikan saat lookup gagal — supaya caller di
// service/auth bisa map ke auth.ErrUserNotFound tanpa import gorm.
var ErrUserNotFound = errors.New("store: user not found")

// UserStore membungkus CRUD model.User. Email opsional (boleh kosong).
type UserStore interface {
	List(ctx context.Context) ([]model.User, error)
	GetByID(ctx context.Context, id uint) (model.User, error)
	GetByUsername(ctx context.Context, username string) (model.User, error)
	Create(ctx context.Context, u *model.User) error
	Update(ctx context.Context, u *model.User) error
	Delete(ctx context.Context, id uint) error
	UpdatePassword(ctx context.Context, id uint, hash string) error
}

type gormUserStore struct{ db *gorm.DB }

func NewUserStore(db *gorm.DB) UserStore { return &gormUserStore{db: db} }

func (s *gormUserStore) List(ctx context.Context) ([]model.User, error) {
	var us []model.User
	err := s.db.WithContext(ctx).Order("id").Find(&us).Error
	return us, err
}

func (s *gormUserStore) GetByID(ctx context.Context, id uint) (model.User, error) {
	var u model.User
	err := s.db.WithContext(ctx).First(&u, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return u, ErrUserNotFound
	}
	return u, err
}

func (s *gormUserStore) GetByUsername(ctx context.Context, username string) (model.User, error) {
	var u model.User
	err := s.db.WithContext(ctx).Where("username = ?", username).First(&u).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return u, ErrUserNotFound
	}
	return u, err
}

func (s *gormUserStore) Create(ctx context.Context, u *model.User) error {
	return s.db.WithContext(ctx).Create(u).Error
}

func (s *gormUserStore) Update(ctx context.Context, u *model.User) error {
	// Pakai Save supaya field non-zero ter-update; Password & Role tidak
	// di-skip kalau caller memang mau update.
	return s.db.WithContext(ctx).Save(u).Error
}

func (s *gormUserStore) Delete(ctx context.Context, id uint) error {
	res := s.db.WithContext(ctx).Delete(&model.User{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrUserNotFound
	}
	return nil
}

func (s *gormUserStore) UpdatePassword(ctx context.Context, id uint, hash string) error {
	res := s.db.WithContext(ctx).Model(&model.User{}).Where("id = ?", id).Update("password", hash)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrUserNotFound
	}
	return nil
}
