package model

import "time"

// Payment adalah record pembayaran untuk Invoice.
// Method manual: 'manual_transfer' | 'cash'.
type Payment struct {
	ID              uint     `gorm:"primaryKey"`
	InvoiceID       uint     `gorm:"not null;index"`
	Invoice         Invoice  `gorm:"foreignKey:InvoiceID;constraint:OnDelete:RESTRICT"`
	CustomerID      uint     `gorm:"not null;index"`
	Customer        Customer `gorm:"foreignKey:CustomerID;constraint:OnDelete:RESTRICT"`
	Amount          int64    `gorm:"not null"`
	Method          string   `gorm:"size:30;not null"`
	ReferenceNumber string   `gorm:"size:100"`
	ProofURL        string   `gorm:"type:text"`
	BankName        string   `gorm:"size:100"`
	Status          string   `gorm:"size:20;not null;default:pending;index"`
	// 'pending' | 'confirmed' | 'rejected'
	ConfirmedBy     *uint `gorm:"index"`
	ConfirmedAt     *time.Time
	RejectionReason string `gorm:"type:text"`
	IdempotencyKey  string `gorm:"size:200;uniqueIndex"`
	CreatedAt       time.Time
	UpdatedAt       time.Time
}
