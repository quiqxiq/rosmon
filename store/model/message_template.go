package model

import "time"

// MessageTemplate adalah template pesan notifikasi (WhatsApp). Body memakai
// sintaks text/template stdlib dengan variabel format {{.FieldName}}. Slug
// unik dipakai sebagai key referensi dari service/notification. Seed default
// dilakukan saat Migrate (seedMessageTemplates).
type MessageTemplate struct {
	ID        uint   `gorm:"primaryKey"`
	Slug      string `gorm:"size:100;uniqueIndex;not null"`
	Name      string `gorm:"size:200;not null"`
	Body      string `gorm:"type:text;not null"`
	Variables string `gorm:"type:text"` // JSON array nama variabel, untuk dokumentasi UI
	Active    bool   `gorm:"not null;default:true"`
	CreatedAt time.Time
	UpdatedAt time.Time
}
