package model

import "time"

// InvoiceItem adalah baris detail dalam Invoice.
type InvoiceItem struct {
	ID          uint    `gorm:"primaryKey"`
	InvoiceID   uint    `gorm:"not null;index"`
	Invoice     Invoice `gorm:"foreignKey:InvoiceID;constraint:OnDelete:CASCADE"`
	Description string  `gorm:"size:255;not null"`
	Quantity    int16   `gorm:"not null;default:1"`
	UnitPrice   int64   `gorm:"not null"`
	Amount      int64   `gorm:"not null"`
	CreatedAt   time.Time
}
