package model

import (
	"time"

	"gorm.io/gorm"
)

// Customer adalah pelanggan rumahan / UMKM yang berlangganan layanan
// (PPPoE atau hotspot permanent). Phone = nomor WhatsApp aktif, dipakai
// sebagai kontak utama. Unique partial index ke phone (WHERE deleted_at
// IS NULL) memungkinkan re-register setelah soft delete.
type Customer struct {
	ID        uint   `gorm:"primaryKey"`
	FullName  string `gorm:"size:200;not null"`
	Phone     string `gorm:"size:20;not null;uniqueIndex:idx_customer_phone,where:deleted_at IS NULL"`
	Address   string `gorm:"type:text"`
	Area      string `gorm:"size:100"`
	Notes     string `gorm:"type:text"`
	Status    string `gorm:"size:20;not null;default:aktif;index"` // 'aktif' | 'nonaktif'
	CreatedBy *uint  `gorm:"index"`                                // → users(id), nullable

	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}
