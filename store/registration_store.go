package store

import (
	"context"
	"errors"

	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
)

var ErrRegistrationNotFound = errors.New("store: registration not found")

// RegistrationListFilter filter opsional untuk List.
type RegistrationListFilter struct {
	Status string
}

// RegistrationStore membungkus CRUD model.CustomerRegistration.
type RegistrationStore interface {
	List(ctx context.Context, f RegistrationListFilter) ([]model.CustomerRegistration, error)
	Get(ctx context.Context, id uint) (model.CustomerRegistration, error)
	Create(ctx context.Context, r *model.CustomerRegistration) error
	Update(ctx context.Context, r *model.CustomerRegistration) error
}

type gormRegistrationStore struct{ db *gorm.DB }

func NewRegistrationStore(db *gorm.DB) RegistrationStore { return &gormRegistrationStore{db: db} }

func (s *gormRegistrationStore) List(ctx context.Context, f RegistrationListFilter) ([]model.CustomerRegistration, error) {
	q := s.db.WithContext(ctx).Order("created_at DESC")
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	var out []model.CustomerRegistration
	return out, q.Find(&out).Error
}

func (s *gormRegistrationStore) Get(ctx context.Context, id uint) (model.CustomerRegistration, error) {
	var r model.CustomerRegistration
	err := s.db.WithContext(ctx).First(&r, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return r, ErrRegistrationNotFound
	}
	return r, err
}

func (s *gormRegistrationStore) Create(ctx context.Context, r *model.CustomerRegistration) error {
	if r.Status == "" {
		r.Status = "pending"
	}
	return s.db.WithContext(ctx).Create(r).Error
}

func (s *gormRegistrationStore) Update(ctx context.Context, r *model.CustomerRegistration) error {
	return s.db.WithContext(ctx).Save(r).Error
}
