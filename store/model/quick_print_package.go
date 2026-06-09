package model

import (
	"time"

	"gorm.io/gorm"
)

// QuickPrintPackage adalah preset konfigurasi generate+cetak voucher yang
// disimpan per-device. Menggantikan penyimpanan di RouterOS /system/script
// (asal frontend dari proyek "roskit"). Semua field numeric disimpan sebagai
// string agar round-trip wire ke frontend identik (lihat
// web/src/features/voucher/print/api/schema.ts) — frontend mem-parse sendiri.
// Unique compound: (device_id, name).
type QuickPrintPackage struct {
	ID       uint           `gorm:"primaryKey"`
	DeviceID uint           `gorm:"not null;uniqueIndex:idx_qpp_dev_name,priority:1"`
	Device   MikrotikDevice `gorm:"foreignKey:DeviceID;constraint:OnDelete:CASCADE"`
	Name     string         `gorm:"size:100;not null;uniqueIndex:idx_qpp_dev_name,priority:2"`

	Server       string `gorm:"size:64"`
	UserMode     string `gorm:"size:8"`  // "up" | "vc"
	UserLength   string `gorm:"size:8"`  // numeric-looking string
	Prefix       string `gorm:"size:32"`
	CharMode     string `gorm:"size:32"` // lower/upper/mixed/number/...
	Profile      string `gorm:"size:128"`
	TimeLimit    string `gorm:"size:32"`
	DataLimit    string `gorm:"size:32"`
	Comment      string `gorm:"size:255"`
	Validity     string `gorm:"size:32"`
	Price        string `gorm:"size:32"`
	SellingPrice string `gorm:"size:32"`
	LockUser     string `gorm:"size:8"` // "0" | "1"

	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}
