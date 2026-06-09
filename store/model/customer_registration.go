package model

import "time"

// CustomerRegistration adalah pengajuan pemasangan dari calon pelanggan
// (lewat form publik) yang masuk antrian admin. ServiceType + PPPProfileID/
// HotspotProfileID/DeviceID = hint paket/layanan yang diminta (opsional);
// detail provisioning final diisi operator saat complete-install.
// Status: 'pending'|'approved'|'rejected'|'cancelled'.
type CustomerRegistration struct {
	ID       uint   `gorm:"primaryKey"`
	FullName string `gorm:"size:200;not null"`
	Phone    string `gorm:"size:20;not null"`
	Address  string `gorm:"type:text;not null"`
	Area     string `gorm:"size:100"`
	Notes    string `gorm:"type:text"`

	ServiceType      string `gorm:"size:10"` // 'pppoe' | 'hotspot' (hint)
	PPPProfileID     *uint  `gorm:"index"`   // paket pppoe yang diminta (hint)
	HotspotProfileID *uint  `gorm:"index"`   // paket hotspot yang diminta (hint)
	DeviceID         *uint  `gorm:"index"`   // router/area yang diminta (hint)

	Status          string `gorm:"size:20;not null;default:pending;index"`
	RejectionReason string `gorm:"type:text"`
	ReviewedBy      *uint  `gorm:"index"` // users(id) yang meninjau
	ReviewedAt      *time.Time
	AssignedTo      *uint `gorm:"index"` // operator users(id) yang ditugaskan instalasi
	ScheduledAt     *time.Time
	InstalledAt     *time.Time
	CustomerID      *uint `gorm:"index"` // di-set saat approve/install

	CreatedAt time.Time
	UpdatedAt time.Time
}
