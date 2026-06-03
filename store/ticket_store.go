package store

import (
	"context"
	"errors"
	"time"

	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
)

var ErrTicketNotFound = errors.New("store: ticket not found")

// TicketListFilter filter untuk list tiket.
type TicketListFilter struct {
	CustomerID uint
	Status     string
	AssignedTo uint
}

type TicketStore interface {
	Create(ctx context.Context, t *model.Ticket) error
	GetByID(ctx context.Context, id uint) (*model.Ticket, error)
	List(ctx context.Context, f TicketListFilter) ([]model.Ticket, error)
	UpdateStatus(ctx context.Context, id uint, status string) error
	Assign(ctx context.Context, id uint, staffUserID uint) error
	Resolve(ctx context.Context, id uint, staffNotes string) error
	Delete(ctx context.Context, id uint) error
}

type gormTicketStore struct{ db *gorm.DB }

func NewTicketStore(db *gorm.DB) TicketStore {
	return &gormTicketStore{db: db}
}

func (s *gormTicketStore) Create(ctx context.Context, t *model.Ticket) error {
	if t.Status == "" {
		t.Status = "open"
	}
	if t.Priority == "" {
		t.Priority = "normal"
	}
	return s.db.WithContext(ctx).Create(t).Error
}

func (s *gormTicketStore) GetByID(ctx context.Context, id uint) (*model.Ticket, error) {
	var t model.Ticket
	err := s.db.WithContext(ctx).Preload("Customer").First(&t, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrTicketNotFound
	}
	return &t, err
}

func (s *gormTicketStore) List(ctx context.Context, f TicketListFilter) ([]model.Ticket, error) {
	q := s.db.WithContext(ctx).Preload("Customer").Order("created_at DESC")
	if f.CustomerID != 0 {
		q = q.Where("customer_id = ?", f.CustomerID)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.AssignedTo != 0 {
		q = q.Where("assigned_to = ?", f.AssignedTo)
	}
	var out []model.Ticket
	return out, q.Find(&out).Error
}

func (s *gormTicketStore) UpdateStatus(ctx context.Context, id uint, status string) error {
	res := s.db.WithContext(ctx).Model(&model.Ticket{}).Where("id = ?", id).Updates(map[string]any{
		"status":     status,
		"updated_at": time.Now(),
	})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrTicketNotFound
	}
	return nil
}

func (s *gormTicketStore) Assign(ctx context.Context, id uint, staffUserID uint) error {
	res := s.db.WithContext(ctx).Model(&model.Ticket{}).Where("id = ?", id).Updates(map[string]any{
		"assigned_to": staffUserID,
		"status":      "in_progress",
		"updated_at":  time.Now(),
	})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrTicketNotFound
	}
	return nil
}

func (s *gormTicketStore) Resolve(ctx context.Context, id uint, staffNotes string) error {
	now := time.Now()
	res := s.db.WithContext(ctx).Model(&model.Ticket{}).Where("id = ?", id).Updates(map[string]any{
		"status":      "resolved",
		"staff_notes": staffNotes,
		"resolved_at": now,
		"updated_at":  now,
	})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrTicketNotFound
	}
	return nil
}

func (s *gormTicketStore) Delete(ctx context.Context, id uint) error {
	res := s.db.WithContext(ctx).Delete(&model.Ticket{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrTicketNotFound
	}
	return nil
}
