package store

import (
	"context"
	"errors"
	"time"

	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
)

var ErrPaymentNotFound = errors.New("store: payment not found")

type PaymentListFilter struct {
	InvoiceID  uint
	CustomerID uint
	Status     string
}

type PaymentStore interface {
	Create(ctx context.Context, p *model.Payment) error
	GetByID(ctx context.Context, id uint) (*model.Payment, error)
	List(ctx context.Context, f PaymentListFilter) ([]model.Payment, error)
	UpdateStatus(ctx context.Context, id uint, status string, confirmedBy *uint, confirmedAt *time.Time, rejectionReason string) error
}

type gormPaymentStore struct{ db *gorm.DB }

func NewPaymentStore(db *gorm.DB) PaymentStore {
	return &gormPaymentStore{db: db}
}

func (s *gormPaymentStore) Create(ctx context.Context, p *model.Payment) error {
	return s.db.WithContext(ctx).Create(p).Error
}

func (s *gormPaymentStore) GetByID(ctx context.Context, id uint) (*model.Payment, error) {
	var p model.Payment
	err := s.db.WithContext(ctx).First(&p, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrPaymentNotFound
	}
	return &p, err
}

func (s *gormPaymentStore) List(ctx context.Context, f PaymentListFilter) ([]model.Payment, error) {
	q := s.db.WithContext(ctx).Order("created_at DESC")
	if f.InvoiceID != 0 {
		q = q.Where("invoice_id = ?", f.InvoiceID)
	}
	if f.CustomerID != 0 {
		q = q.Where("customer_id = ?", f.CustomerID)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	var out []model.Payment
	return out, q.Find(&out).Error
}

func (s *gormPaymentStore) UpdateStatus(ctx context.Context, id uint, status string, confirmedBy *uint, confirmedAt *time.Time, rejectionReason string) error {
	updates := map[string]any{
		"status":           status,
		"rejection_reason": rejectionReason,
		"updated_at":       time.Now(),
	}
	if confirmedBy != nil {
		updates["confirmed_by"] = *confirmedBy
	}
	if confirmedAt != nil {
		updates["confirmed_at"] = *confirmedAt
	}
	res := s.db.WithContext(ctx).Model(&model.Payment{}).Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrPaymentNotFound
	}
	return nil
}
