package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/quiqxiq/roslib-mikhmon/store/model"
	"gorm.io/gorm"
)

var (
	ErrSubscriptionNotFound        = errors.New("store: subscription not found")
	ErrSubscriptionUsernameTaken   = errors.New("store: mikrotik_username already used on this device")
	ErrSubscriptionInvalidStatus   = errors.New("store: invalid subscription status")
)

// SubscriptionListFilter optional filter. Field nol = tidak filter.
type SubscriptionListFilter struct {
	CustomerID  uint
	DeviceID    uint
	Status      string
	ServiceType string
}

type SubscriptionStore interface {
	List(ctx context.Context, f SubscriptionListFilter) ([]model.Subscription, error)
	Get(ctx context.Context, id uint) (model.Subscription, error)
	Create(ctx context.Context, s *model.Subscription) error
	Update(ctx context.Context, s *model.Subscription) error
	UpdateStatus(ctx context.Context, id uint, status string, activatedAt, terminatedAt *time.Time) error
	Delete(ctx context.Context, id uint) error
}

type gormSubscriptionStore struct{ db *gorm.DB }

func NewSubscriptionStore(db *gorm.DB) SubscriptionStore {
	return &gormSubscriptionStore{db: db}
}

// decryptSubscriptions decrypt MikrotikPassword pada setiap row.
func decryptSubscriptions(ss []model.Subscription) ([]model.Subscription, error) {
	for i := range ss {
		p, err := decryptSecret(ss[i].MikrotikPassword)
		if err != nil {
			return nil, err
		}
		ss[i].MikrotikPassword = p
	}
	return ss, nil
}

func (s *gormSubscriptionStore) List(ctx context.Context, f SubscriptionListFilter) ([]model.Subscription, error) {
	q := s.db.WithContext(ctx).Order("created_at DESC")
	if f.CustomerID != 0 {
		q = q.Where("customer_id = ?", f.CustomerID)
	}
	if f.DeviceID != 0 {
		q = q.Where("device_id = ?", f.DeviceID)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.ServiceType != "" {
		q = q.Where("service_type = ?", f.ServiceType)
	}
	var out []model.Subscription
	if err := q.Find(&out).Error; err != nil {
		return nil, err
	}
	return decryptSubscriptions(out)
}

func (s *gormSubscriptionStore) Get(ctx context.Context, id uint) (model.Subscription, error) {
	var sub model.Subscription
	err := s.db.WithContext(ctx).First(&sub, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return sub, ErrSubscriptionNotFound
	}
	if err != nil {
		return sub, err
	}
	p, decErr := decryptSecret(sub.MikrotikPassword)
	if decErr != nil {
		return sub, decErr
	}
	sub.MikrotikPassword = p
	return sub, nil
}

func (s *gormSubscriptionStore) Create(ctx context.Context, sub *model.Subscription) error {
	enc, err := encryptSecret(sub.MikrotikPassword)
	if err != nil {
		return err
	}
	orig := sub.MikrotikPassword
	sub.MikrotikPassword = enc
	if sub.Status == "" {
		sub.Status = "pending_install"
	}
	if err := s.db.WithContext(ctx).Create(sub).Error; err != nil {
		sub.MikrotikPassword = orig
		if isSubscriptionUniqueErr(err) {
			return ErrSubscriptionUsernameTaken
		}
		return err
	}
	sub.MikrotikPassword = orig
	return nil
}

func (s *gormSubscriptionStore) Update(ctx context.Context, sub *model.Subscription) error {
	enc, err := encryptSecret(sub.MikrotikPassword)
	if err != nil {
		return err
	}
	orig := sub.MikrotikPassword
	sub.MikrotikPassword = enc
	// Pakai Save supaya nullable timestamp (activated_at, terminated_at)
	// dapat di-set ke nil maupun nilai konkret.
	err = s.db.WithContext(ctx).Save(sub).Error
	sub.MikrotikPassword = orig
	if err != nil {
		if isSubscriptionUniqueErr(err) {
			return ErrSubscriptionUsernameTaken
		}
		return err
	}
	return nil
}

func (s *gormSubscriptionStore) UpdateStatus(ctx context.Context, id uint, status string, activatedAt, terminatedAt *time.Time) error {
	updates := map[string]any{
		"status":     status,
		"updated_at": time.Now(),
	}
	if activatedAt != nil {
		updates["activated_at"] = *activatedAt
	}
	if terminatedAt != nil {
		updates["terminated_at"] = *terminatedAt
	}
	res := s.db.WithContext(ctx).Model(&model.Subscription{}).Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrSubscriptionNotFound
	}
	return nil
}

func (s *gormSubscriptionStore) Delete(ctx context.Context, id uint) error {
	res := s.db.WithContext(ctx).Delete(&model.Subscription{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrSubscriptionNotFound
	}
	return nil
}

func isSubscriptionUniqueErr(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	if strings.Contains(msg, "idx_sub_dev_type_user") {
		return true
	}
	if strings.Contains(msg, "UNIQUE constraint") || strings.Contains(msg, "duplicate key") {
		return true
	}
	return false
}
