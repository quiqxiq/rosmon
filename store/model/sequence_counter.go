package model

import "time"

// SequenceCounter dipakai untuk generate nomor dokumen berurutan.
// Format: {Prefix}-{Year}-{Month:02d}-{LastValue:04d}
// Contoh: INV-2026-05-0001
type SequenceCounter struct {
	ID        uint   `gorm:"primaryKey"`
	Prefix    string `gorm:"size:20;not null;uniqueIndex:idx_seq_prefix_ym,priority:1"`
	Year      int16  `gorm:"not null;uniqueIndex:idx_seq_prefix_ym,priority:2"`
	Month     int16  `gorm:"not null;default:0;uniqueIndex:idx_seq_prefix_ym,priority:3"`
	LastValue int    `gorm:"not null;default:0"`
	UpdatedAt time.Time
}
