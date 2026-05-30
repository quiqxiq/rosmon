package model

import "time"

// NotificationLog mencatat setiap upaya pengiriman notifikasi. Selalu ditulis
// meski pengiriman gagal (status='failed' + NextRetryAt) supaya bisa di-retry
// oleh job/notif_retry. CustomerID null untuk notifikasi non-pelanggan
// (mis. ke admin). Status: 'pending' | 'sent' | 'failed' | 'skipped'.
type NotificationLog struct {
	ID               uint   `gorm:"primaryKey"`
	CustomerID       *uint  `gorm:"index"`
	TemplateSlug     string `gorm:"size:100;not null"`
	RecipientPhone   string `gorm:"size:20;not null"`
	MessageBody      string `gorm:"type:text;not null"`
	Status           string `gorm:"size:20;not null;default:pending;index:idx_notif_retry,priority:1"`
	Provider         string `gorm:"size:50"`
	ProviderResponse string `gorm:"type:text"` // JSON respons provider (opsional)
	RetryCount       int    `gorm:"not null;default:0"`
	SentAt           *time.Time
	NextRetryAt      *time.Time `gorm:"index:idx_notif_retry,priority:2"`
	CreatedAt        time.Time
}
