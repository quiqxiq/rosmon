package store

import (
	"context"
	"fmt"
	"time"

	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type SequenceStore interface {
	// NextVal atomically increments and returns the next sequence value.
	// Uses SELECT FOR UPDATE to be concurrency-safe.
	NextVal(ctx context.Context, prefix string, year, month int) (int, error)
	// FormatNumber formats a sequence value as a document number.
	// E.g. FormatNumber("INV", 2026, 5, 1) → "INV-2026-05-0001"
	FormatNumber(prefix string, year, month, value int) string
}

type gormSequenceStore struct{ db *gorm.DB }

func NewSequenceStore(db *gorm.DB) SequenceStore {
	return &gormSequenceStore{db: db}
}

func (s *gormSequenceStore) NextVal(ctx context.Context, prefix string, year, month int) (int, error) {
	var next int
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var counter model.SequenceCounter
		result := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("prefix = ? AND year = ? AND month = ?", prefix, year, month).
			First(&counter)

		if result.Error != nil && result.Error != gorm.ErrRecordNotFound {
			return result.Error
		}

		if result.Error == gorm.ErrRecordNotFound {
			counter = model.SequenceCounter{
				Prefix:    prefix,
				Year:      int16(year),
				Month:     int16(month),
				LastValue: 1,
				UpdatedAt: time.Now(),
			}
			if err := tx.Create(&counter).Error; err != nil {
				return err
			}
			next = 1
			return nil
		}

		counter.LastValue++
		counter.UpdatedAt = time.Now()
		if err := tx.Save(&counter).Error; err != nil {
			return err
		}
		next = counter.LastValue
		return nil
	})
	return next, err
}

func (s *gormSequenceStore) FormatNumber(prefix string, year, month, value int) string {
	if month > 0 {
		return fmt.Sprintf("%s-%d-%02d-%04d", prefix, year, month, value)
	}
	return fmt.Sprintf("%s-%d-%04d", prefix, year, value)
}
