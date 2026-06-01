package store

import (
	"context"
	"errors"
	"time"

	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
)

var ErrInvoiceNotFound = errors.New("store: invoice not found")

type InvoiceListFilter struct {
	CustomerID     uint
	SubscriptionID uint
	Status         string
}

type InvoiceStore interface {
	Create(ctx context.Context, inv *model.Invoice, items []model.InvoiceItem) error
	GetByID(ctx context.Context, id uint) (*model.Invoice, error)
	// GetByPaymentCode mencari invoice via kode pembayaran unik (settle-by-code).
	GetByPaymentCode(ctx context.Context, code string) (*model.Invoice, error)
	List(ctx context.Context, f InvoiceListFilter) ([]model.Invoice, error)
	UpdateStatus(ctx context.Context, id uint, status string, paidAt *time.Time) error
	// ListDueForBilling returns active-status invoices with due_date == today (for billing cron).
	ListDueForBilling(ctx context.Context, date time.Time) ([]model.Invoice, error)
	// ListOverdue returns issued invoices with due_date before cutoff.
	ListOverdue(ctx context.Context, cutoff time.Time) ([]model.Invoice, error)
}

type gormInvoiceStore struct{ db *gorm.DB }

func NewInvoiceStore(db *gorm.DB) InvoiceStore {
	return &gormInvoiceStore{db: db}
}

func (s *gormInvoiceStore) Create(ctx context.Context, inv *model.Invoice, items []model.InvoiceItem) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(inv).Error; err != nil {
			return err
		}
		for i := range items {
			items[i].InvoiceID = inv.ID
		}
		if len(items) > 0 {
			return tx.Create(&items).Error
		}
		return nil
	})
}

func (s *gormInvoiceStore) GetByID(ctx context.Context, id uint) (*model.Invoice, error) {
	var inv model.Invoice
	err := s.db.WithContext(ctx).First(&inv, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrInvoiceNotFound
	}
	return &inv, err
}

func (s *gormInvoiceStore) GetByPaymentCode(ctx context.Context, code string) (*model.Invoice, error) {
	if code == "" {
		return nil, ErrInvoiceNotFound
	}
	var inv model.Invoice
	err := s.db.WithContext(ctx).Where("payment_code = ?", code).First(&inv).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrInvoiceNotFound
	}
	return &inv, err
}

func (s *gormInvoiceStore) List(ctx context.Context, f InvoiceListFilter) ([]model.Invoice, error) {
	q := s.db.WithContext(ctx).Order("created_at DESC")
	if f.CustomerID != 0 {
		q = q.Where("customer_id = ?", f.CustomerID)
	}
	if f.SubscriptionID != 0 {
		q = q.Where("subscription_id = ?", f.SubscriptionID)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	var out []model.Invoice
	return out, q.Find(&out).Error
}

func (s *gormInvoiceStore) UpdateStatus(ctx context.Context, id uint, status string, paidAt *time.Time) error {
	updates := map[string]any{
		"status":     status,
		"updated_at": time.Now(),
	}
	if paidAt != nil {
		updates["paid_at"] = *paidAt
	}
	if status == "issued" {
		now := time.Now()
		updates["issued_at"] = now
	}
	res := s.db.WithContext(ctx).Model(&model.Invoice{}).Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrInvoiceNotFound
	}
	return nil
}

func (s *gormInvoiceStore) ListDueForBilling(ctx context.Context, date time.Time) ([]model.Invoice, error) {
	var out []model.Invoice
	err := s.db.WithContext(ctx).
		Where("DATE(due_date) = DATE(?) AND status = ?", date, "issued").
		Find(&out).Error
	return out, err
}

func (s *gormInvoiceStore) ListOverdue(ctx context.Context, cutoff time.Time) ([]model.Invoice, error) {
	var out []model.Invoice
	err := s.db.WithContext(ctx).
		Where("due_date < ? AND status IN ?", cutoff, []string{"issued", "overdue"}).
		Find(&out).Error
	return out, err
}
