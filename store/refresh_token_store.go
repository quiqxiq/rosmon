package store

import (
	"context"
	"errors"
	"time"

	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
)

// ErrRefreshTokenNotFound dikembalikan oleh GetByJTI ketika jti tidak
// ada di DB.
var ErrRefreshTokenNotFound = errors.New("store: refresh token not found")

// RefreshTokenStore mengelola refresh_tokens table.
type RefreshTokenStore interface {
	Create(ctx context.Context, t *model.RefreshToken) error
	GetByJTI(ctx context.Context, jti string) (model.RefreshToken, error)
	Revoke(ctx context.Context, jti string, at time.Time) error
	RevokeAllForUser(ctx context.Context, userID uint, at time.Time) error
	PurgeExpired(ctx context.Context, before time.Time) (int64, error)
}

type gormRefreshTokenStore struct{ db *gorm.DB }

func NewRefreshTokenStore(db *gorm.DB) RefreshTokenStore {
	return &gormRefreshTokenStore{db: db}
}

func (s *gormRefreshTokenStore) Create(ctx context.Context, t *model.RefreshToken) error {
	return s.db.WithContext(ctx).Create(t).Error
}

func (s *gormRefreshTokenStore) GetByJTI(ctx context.Context, jti string) (model.RefreshToken, error) {
	var t model.RefreshToken
	err := s.db.WithContext(ctx).Where("jti = ?", jti).First(&t).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return t, ErrRefreshTokenNotFound
	}
	return t, err
}

func (s *gormRefreshTokenStore) Revoke(ctx context.Context, jti string, at time.Time) error {
	res := s.db.WithContext(ctx).Model(&model.RefreshToken{}).
		Where("jti = ? AND revoked_at IS NULL", jti).
		Update("revoked_at", at)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrRefreshTokenNotFound
	}
	return nil
}

func (s *gormRefreshTokenStore) RevokeAllForUser(ctx context.Context, userID uint, at time.Time) error {
	return s.db.WithContext(ctx).Model(&model.RefreshToken{}).
		Where("user_id = ? AND revoked_at IS NULL", userID).
		Update("revoked_at", at).Error
}

func (s *gormRefreshTokenStore) PurgeExpired(ctx context.Context, before time.Time) (int64, error) {
	res := s.db.WithContext(ctx).Where("expires_at < ?", before).Delete(&model.RefreshToken{})
	return res.RowsAffected, res.Error
}
