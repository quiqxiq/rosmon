package model

import "time"

// Payment adalah record pembayaran untuk Invoice.
// Method manual: 'manual_transfer' | 'cash'.
// Method gateway: 'xendit' | 'tripay'.
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

	// Gateway fields (nullable — backward compatible dengan pembayaran manual lama).
	// GatewayName: 'xendit' | 'tripay' | '' (manual cash/transfer).
	GatewayName     string     `gorm:"size:30;index"`
	ExternalRef     string     `gorm:"size:200;index"` // ID invoice/transaksi di sisi gateway
	GatewayResponse string     `gorm:"type:text"`      // raw JSON response dari gateway (untuk audit)
	InvoiceURL      string     `gorm:"type:text"`      // checkout URL yang diberikan ke pelanggan
	ExpiresAt       *time.Time // waktu kadaluarsa link pembayaran gateway

	CreatedAt time.Time
	UpdatedAt time.Time
}
