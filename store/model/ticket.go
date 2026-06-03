package model

import (
	"time"

	"gorm.io/gorm"
)

// Ticket adalah tiket dukungan/trouble ticket dari pelanggan ke staff.
// Status: open → in_progress → resolved → closed.
// Priority: low | normal | high.
type Ticket struct {
	ID         uint     `gorm:"primaryKey"`
	CustomerID uint     `gorm:"not null;index"`
	Customer   Customer `gorm:"foreignKey:CustomerID;constraint:OnDelete:RESTRICT"`

	Subject  string `gorm:"size:200;not null"`
	Body     string `gorm:"type:text"`
	Status   string `gorm:"size:20;not null;default:open;index"` // open|in_progress|resolved|closed
	Priority string `gorm:"size:10;not null;default:normal"`      // low|normal|high

	// AssignedTo adalah user staff yang menangani tiket ini.
	AssignedTo *uint  `gorm:"index"`
	AssignedToUser *User `gorm:"foreignKey:AssignedTo;constraint:OnDelete:SET NULL"`

	// StaffNotes adalah catatan internal yang hanya terlihat oleh staff.
	StaffNotes string `gorm:"type:text"`

	ResolvedAt *time.Time
	ClosedAt   *time.Time

	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}
