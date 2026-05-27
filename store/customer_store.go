package store

import (
	"context"
	"errors"
	"strings"

	"github.com/quiqxiq/roslib-mikhmon/store/model"
	"gorm.io/gorm"
)

var (
	ErrCustomerNotFound   = errors.New("store: customer not found")
	ErrCustomerPhoneTaken = errors.New("store: customer phone already registered")
)

// CustomerListFilter adalah filter opsional untuk List. Field kosong =
// tidak filter pada kolom tersebut. Q (search) match case-insensitive pada
// full_name + phone + area.
type CustomerListFilter struct {
	Status string
	Area   string
	Q      string
}

type CustomerStore interface {
	List(ctx context.Context, f CustomerListFilter) ([]model.Customer, error)
	Get(ctx context.Context, id uint) (model.Customer, error)
	GetByPhone(ctx context.Context, phone string) (model.Customer, error)
	Create(ctx context.Context, c *model.Customer) error
	Update(ctx context.Context, c *model.Customer) error
	Delete(ctx context.Context, id uint) error
}

type gormCustomerStore struct{ db *gorm.DB }

func NewCustomerStore(db *gorm.DB) CustomerStore { return &gormCustomerStore{db: db} }

func (s *gormCustomerStore) List(ctx context.Context, f CustomerListFilter) ([]model.Customer, error) {
	q := s.db.WithContext(ctx).Order("created_at DESC")
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.Area != "" {
		q = q.Where("area = ?", f.Area)
	}
	if f.Q != "" {
		like := "%" + strings.ToLower(f.Q) + "%"
		q = q.Where("LOWER(full_name) LIKE ? OR LOWER(phone) LIKE ? OR LOWER(area) LIKE ?", like, like, like)
	}
	var out []model.Customer
	err := q.Find(&out).Error
	return out, err
}

func (s *gormCustomerStore) Get(ctx context.Context, id uint) (model.Customer, error) {
	var c model.Customer
	err := s.db.WithContext(ctx).First(&c, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return c, ErrCustomerNotFound
	}
	return c, err
}

func (s *gormCustomerStore) GetByPhone(ctx context.Context, phone string) (model.Customer, error) {
	var c model.Customer
	err := s.db.WithContext(ctx).Where("phone = ?", phone).First(&c).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return c, ErrCustomerNotFound
	}
	return c, err
}

func (s *gormCustomerStore) Create(ctx context.Context, c *model.Customer) error {
	if c.Status == "" {
		c.Status = "aktif"
	}
	if err := s.db.WithContext(ctx).Create(c).Error; err != nil {
		if isUniqueViolation(err, "idx_customer_phone") {
			return ErrCustomerPhoneTaken
		}
		return err
	}
	return nil
}

func (s *gormCustomerStore) Update(ctx context.Context, c *model.Customer) error {
	if err := s.db.WithContext(ctx).Save(c).Error; err != nil {
		if isUniqueViolation(err, "idx_customer_phone") {
			return ErrCustomerPhoneTaken
		}
		return err
	}
	return nil
}

func (s *gormCustomerStore) Delete(ctx context.Context, id uint) error {
	res := s.db.WithContext(ctx).Delete(&model.Customer{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrCustomerNotFound
	}
	return nil
}

// isUniqueViolation cek apakah error berasal dari unique constraint
// dengan nama tertentu. PostgreSQL: error message mengandung nama index.
// SQLite (test): pesan berbeda — fallback ke substring "UNIQUE constraint".
func isUniqueViolation(err error, indexName string) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	if strings.Contains(msg, indexName) {
		return true
	}
	if strings.Contains(msg, "UNIQUE constraint") || strings.Contains(msg, "duplicate key") {
		return true
	}
	return false
}
