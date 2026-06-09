package model

import "time"

// AuditLog mencatat aksi yang mengubah status entitas utama (subscription,
// invoice, payment, customer, dst). UserID null = aksi sistem (cron/webhook).
// OldValues / NewValues adalah snapshot JSON state sebelum & sesudah perubahan
// (boleh kosong). Ditulis lewat helper service/audit secara non-fatal.
type AuditLog struct {
	ID         uint      `gorm:"primaryKey"`
	UserID     *uint     `gorm:"index"` // null = aksi sistem
	Action     string    `gorm:"size:50;not null"`
	EntityType string    `gorm:"size:100;not null;index:idx_audit_entity,priority:1"`
	EntityID   *uint     `gorm:"index:idx_audit_entity,priority:2"`
	OldValues  string    `gorm:"type:text"` // JSON snapshot, opsional
	NewValues  string    `gorm:"type:text"` // JSON snapshot, opsional
	IPAddress  string    `gorm:"size:45"`
	Notes      string    `gorm:"type:text"`
	CreatedAt  time.Time `gorm:"index"`
}
