package model

import (
	"time"

	"gorm.io/gorm"
)

// HotspotProfile adalah paket layanan hotspot per device.
// Name = nama profile di /ip/hotspot/user/profile RouterOS.
// Role membedakan: 'permanent' (pelanggan bulanan) vs 'voucher' (expiry-based).
// Unique compound: (device_id, name).
type HotspotProfile struct {
	ID       uint           `gorm:"primaryKey"`
	DeviceID uint           `gorm:"not null;uniqueIndex:idx_hp_dev_name,where:deleted_at IS NULL,priority:1"`
	Device   MikrotikDevice `gorm:"foreignKey:DeviceID;constraint:OnDelete:CASCADE"`
	Name     string         `gorm:"size:100;not null;uniqueIndex:idx_hp_dev_name,where:deleted_at IS NULL,priority:2"`
	Role     string         `gorm:"size:20;not null;default:permanent"` // 'permanent' | 'voucher'

	RateLimit string `gorm:"size:64"`

	// RouterOS /ip/hotspot/user/profile config (pushed to & pulled from device).
	AddressPool       string `gorm:"size:64"`
	SharedUsers       int    `gorm:"not null;default:1"`
	StatusAutorefresh string `gorm:"size:16"` // mis. "1m"
	ParentQueue       string `gorm:"size:64"`

	// Permanent-only fields.
	PriceMonthly int64 `gorm:"not null;default:0"`

	// Voucher-only fields (sebelumnya di HotspotProfileConfig).
	ExpiryMode string `gorm:"size:8;default:'0'"` // "0"|"rem"|"ntf"|"remc"|"ntfc"
	Validity   string `gorm:"size:16"`            // "30d", "1d", dll
	Price      int
	SellPrice  int
	LockMAC    bool `gorm:"default:false"`

	Description string `gorm:"type:text"`
	Active      bool   `gorm:"not null;default:true"`

	// IsPublic menandai paket ditawarkan di form pendaftaran publik
	// (GET /public/packages). Hanya berlaku untuk Role 'permanent'.
	IsPublic bool `gorm:"not null;default:false;index"`

	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}
