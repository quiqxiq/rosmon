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
//   - active          — aktif, profile normal, disabled=no
//   - isolir          — profile isolir (dari system_settings), disabled=no (throttle)
//   - suspended       — disabled=yes keras (mis. hutang lama / pelanggaran TOS)
//   - terminated      — secret sudah dihapus di router, record di-keep untuk audit
type Subscription struct {
	ID               uint            `gorm:"primaryKey"`
	CustomerID       uint            `gorm:"not null;index"`
	Customer         Customer        `gorm:"foreignKey:CustomerID;constraint:OnDelete:RESTRICT"`
	DeviceID         uint            `gorm:"not null;uniqueIndex:idx_sub_dev_type_user,where:deleted_at IS NULL,priority:1"`
	Device           MikrotikDevice  `gorm:"foreignKey:DeviceID;constraint:OnDelete:RESTRICT"`
	PPPProfileID     *uint           `gorm:"index"` // non-null untuk pppoe
	PPPProfile       *PPPProfile     `gorm:"foreignKey:PPPProfileID;constraint:OnDelete:RESTRICT"`
	HotspotProfileID *uint           `gorm:"index"` // non-null untuk hotspot permanent
	HotspotProfile   *HotspotProfile `gorm:"foreignKey:HotspotProfileID;constraint:OnDelete:RESTRICT"`

	ServiceType      string `gorm:"size:10;not null;uniqueIndex:idx_sub_dev_type_user,where:deleted_at IS NULL,priority:2"` // 'pppoe' | 'hotspot'
	MikrotikUsername string `gorm:"size:100;not null;uniqueIndex:idx_sub_dev_type_user,where:deleted_at IS NULL,priority:3"`
	MikrotikPassword string `gorm:"type:text;not null"` // encrypted at rest

	Status     string `gorm:"size:20;not null;default:pending_install;index"`
	BillingDay *int   `gorm:"type:smallint"`
	// Tanggal invoice berikutnya — di-set saat aktivasi, auto-increment tiap billing_cron.
	NextInvoiceDate *time.Time `gorm:"type:date"`
	// SyncStatus adalah outbox flag untuk background outbox goroutine.
	// 'synced' = tidak ada pending. Nilai lain = perlu eksekusi MikroTik.
	SyncStatus     string `gorm:"size:30;not null;default:synced"`
	SyncNotes      string `gorm:"type:text"`
	SyncRetryCount int    `gorm:"not null;default:0"` // jumlah retry gagal berturut-turut; reset saat synced
	ActivatedAt  *time.Time
	TerminatedAt *time.Time
	Notes        string `gorm:"type:text"`

	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}
