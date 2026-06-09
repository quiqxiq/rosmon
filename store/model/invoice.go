package model

import "time"

// Invoice adalah tagihan bulanan pelanggan.
// InvoiceNumber dihasilkan dari SequenceCounter: INV-YYYY-MM-NNNN.
// Guard idempotency: UNIQUE (subscription_id, period_start).
type Invoice struct {
	ID             uint         `gorm:"primaryKey"`
	InvoiceNumber  string       `gorm:"size:50;uniqueIndex;not null"`
	CustomerID     uint         `gorm:"not null;index"`
	Customer       Customer     `gorm:"foreignKey:CustomerID;constraint:OnDelete:RESTRICT"`
	SubscriptionID uint         `gorm:"not null;index;uniqueIndex:idx_inv_sub_period,priority:1"`
	Subscription   Subscription `gorm:"foreignKey:SubscriptionID;constraint:OnDelete:RESTRICT"`
	Amount         int64        `gorm:"not null"`
	PeriodStart    time.Time    `gorm:"type:date;not null;uniqueIndex:idx_inv_sub_period,priority:2"`
	PeriodEnd      time.Time    `gorm:"type:date;not null"`
	DueDate        time.Time    `gorm:"type:date;not null;index"`
	Status         string       `gorm:"size:20;not null;default:draft;index"`
	// 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled'

	// PaymentCode = kode unik untuk pembayaran via scan QR / input kode oleh
	// petugas (settle-by-code). Partial unique index agar baris lama berkode
	// kosong tidak bentrok. QR di-render sisi-klien dari kode ini.
	PaymentCode string `gorm:"size:32;uniqueIndex:uq_inv_payment_code,where:payment_code <> ''"`

	IssuedAt  *time.Time
	PaidAt    *time.Time
	Notes     string `gorm:"type:text"`
	CreatedAt time.Time
	UpdatedAt time.Time
}
