package model

import (
	"time"

	"gorm.io/gorm"
)

// PPPProfile adalah paket layanan PPPoE per device.
// Name = nama profile di /ppp/profile RouterOS.
// Unique compound: (device_id, name).
type PPPProfile struct {
	ID       uint           `gorm:"primaryKey"`
	DeviceID uint           `gorm:"not null;uniqueIndex:idx_pp_dev_name,where:deleted_at IS NULL,priority:1"`
	Device   MikrotikDevice `gorm:"foreignKey:DeviceID;constraint:OnDelete:CASCADE"`
	Name     string         `gorm:"size:100;not null;uniqueIndex:idx_pp_dev_name,where:deleted_at IS NULL,priority:2"`

	RateLimit string `gorm:"size:64"`

	// RouterOS /ppp/profile config (pushed to & pulled from device).
	LocalAddress   string `gorm:"size:64"`
	RemoteAddress  string `gorm:"size:64"` // biasanya nama IP pool
	SessionTimeout string `gorm:"size:32"`
	IdleTimeout    string `gorm:"size:32"`
	ParentQueue    string `gorm:"size:64"`

	PriceMonthly int64  `gorm:"not null;default:0"`
	Description  string `gorm:"type:text"`
	Active       bool   `gorm:"not null;default:true"`

	// IsPublic menandai paket ditawarkan di form pendaftaran publik
	// (GET /public/packages). Default false — operator menandai manual.
	IsPublic bool `gorm:"not null;default:false;index"`

	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}
