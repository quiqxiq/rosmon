package model

import (
	"time"

	"gorm.io/gorm"
)

// BandwidthProfile adalah paket layanan PPPoE atau hotspot permanent per
// device. MikrotikProfileName = join key ke `/ppp/profile` (PPPoE) atau
// `/ip/hotspot/user/profile` (hotspot). Unique compound:
// (device_id, service_type, mikrotik_profile_name).
//
// Field service-specific dipisah supaya operator bisa mengelola full set
// parameter MikroTik per tipe layanan. Saat propagate, handler hanya
// pass field yang relevan dengan service_type-nya.
type BandwidthProfile struct {
	// Identity
	ID                  uint           `gorm:"primaryKey"`
	DeviceID            uint           `gorm:"not null;uniqueIndex:idx_bwp_dev_type_name,priority:1"`
	Device              MikrotikDevice `gorm:"foreignKey:DeviceID;constraint:OnDelete:CASCADE"`
	ServiceType         string         `gorm:"size:10;not null;uniqueIndex:idx_bwp_dev_type_name,priority:2"` // 'pppoe' | 'hotspot'
	Name                string         `gorm:"size:100;not null"`
	MikrotikProfileName string         `gorm:"size:100;not null;uniqueIndex:idx_bwp_dev_type_name,priority:3"`

	// Common (PPPoE + Hotspot)
	RateLimit   string `gorm:"size:64"`  // "10M/10M", nullable
	ParentQueue string `gorm:"size:100"` // queue tree reference, opsional

	// PPPoE-only
	LocalAddress   string `gorm:"size:100"` // gateway IP
	RemoteAddress  string `gorm:"size:100"` // IP pool name atau IP tunggal
	SessionTimeout string `gorm:"size:32"`  // RouterOS duration (mis. "1h30m")
	IdleTimeout    string `gorm:"size:32"`  // RouterOS duration

	// Hotspot-only
	AddressPool string `gorm:"size:100"`            // nama IP pool DHCP
	SharedUsers int    `gorm:"not null;default:1"`  // concurrent session limit (default 1)

	// Business
	PriceMonthly int64  `gorm:"not null;default:0"`
	Description  string `gorm:"type:text"`
	Active       bool   `gorm:"not null;default:true"`

	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}
