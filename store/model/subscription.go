package model

import (
	"time"

	"gorm.io/gorm"
)

// Subscription mengikat customer ke layanan PPPoE atau hotspot permanent
// di sebuah device. MikrotikUsername adalah join key ke `/ppp/secret`
// (PPPoE) atau `/ip/hotspot/user` (hotspot). MikrotikPassword di-encrypt
// AES-256-GCM saat at rest (lihat store/crypto.go).
//
// Status enum:
//   - pending_install — record dibuat, belum di-provision di router
//   - active          — aktif, secret enabled di router
//   - isolir          — disabled sementara (mis. paket expired-soft)
//   - suspended       — disabled keras (mis. melanggar TOS / hutang lama)
//   - terminated      — secret sudah dihapus di router, record di-keep untuk audit
type Subscription struct {
	ID                 uint           `gorm:"primaryKey"`
	CustomerID         uint           `gorm:"not null;index"`
	Customer           Customer       `gorm:"foreignKey:CustomerID;constraint:OnDelete:RESTRICT"`
	DeviceID           uint           `gorm:"not null;uniqueIndex:idx_sub_dev_type_user,priority:1"`
	Device             MikrotikDevice `gorm:"foreignKey:DeviceID;constraint:OnDelete:RESTRICT"`
	BandwidthProfileID uint           `gorm:"not null;index"`
	BandwidthProfile   BandwidthProfile `gorm:"foreignKey:BandwidthProfileID;constraint:OnDelete:RESTRICT"`

	ServiceType      string `gorm:"size:10;not null;uniqueIndex:idx_sub_dev_type_user,priority:2"` // 'pppoe' | 'hotspot'
	MikrotikUsername string `gorm:"size:100;not null;uniqueIndex:idx_sub_dev_type_user,priority:3"`
	MikrotikPassword string `gorm:"type:text;not null"` // encrypted at rest

	Status       string     `gorm:"size:20;not null;default:pending_install;index"`
	ActivatedAt  *time.Time
	TerminatedAt *time.Time
	Notes        string `gorm:"type:text"`

	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}
