package dto

import (
	"time"

	"github.com/quiqxiq/roslib-mikhmon/store/model"
)

// BandwidthProfileResponse adalah representasi paket layanan PPPoE atau
// hotspot permanent yang ter-link ke profile MikroTik. Field
// service-specific (mis. AddressPool, LocalAddress) hanya bermakna untuk
// service_type yang relevan; untuk service_type lawan field tersebut
// boleh kosong/0.
type BandwidthProfileResponse struct {
	ID                  uint   `json:"id"`
	DeviceID            uint   `json:"device_id"`
	ServiceType         string `json:"service_type"`
	Name                string `json:"name"`
	MikrotikProfileName string `json:"mikrotik_profile_name"`

	// Common
	RateLimit   string `json:"rate_limit"`
	ParentQueue string `json:"parent_queue,omitempty"`

	// PPPoE-only
	LocalAddress   string `json:"local_address,omitempty"`
	RemoteAddress  string `json:"remote_address,omitempty"`
	SessionTimeout string `json:"session_timeout,omitempty"`
	IdleTimeout    string `json:"idle_timeout,omitempty"`

	// Hotspot-only
	AddressPool string `json:"address_pool,omitempty"`
	SharedUsers int    `json:"shared_users"`

	// Business
	PriceMonthly int64     `json:"price_monthly"`
	Description  string    `json:"description"`
	Active       bool      `json:"active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// BandwidthProfileCreateRequest body untuk POST nested di bawah device.
// Frontend bertanggung jawab kirim field yang sesuai dengan service_type;
// handler hanya pass ke MikroTik kalau service_type match.
type BandwidthProfileCreateRequest struct {
	ServiceType         string `json:"service_type"           binding:"required,oneof=pppoe hotspot"`
	Name                string `json:"name"                   binding:"required,min=1,max=100"`
	MikrotikProfileName string `json:"mikrotik_profile_name"  binding:"required,min=1,max=100"`

	// Common
	RateLimit   string `json:"rate_limit"   binding:"max=64"`
	ParentQueue string `json:"parent_queue" binding:"max=100"`

	// PPPoE-only
	LocalAddress   string `json:"local_address"   binding:"max=100"`
	RemoteAddress  string `json:"remote_address"  binding:"max=100"`
	SessionTimeout string `json:"session_timeout" binding:"max=32"`
	IdleTimeout    string `json:"idle_timeout"    binding:"max=32"`

	// Hotspot-only
	AddressPool string `json:"address_pool" binding:"max=100"`
	SharedUsers int    `json:"shared_users" binding:"gte=0"`

	// Business
	PriceMonthly int64  `json:"price_monthly" binding:"gte=0"`
	Description  string `json:"description"   binding:"max=2000"`
	Active       *bool  `json:"active"`
}

// BandwidthProfileUpdateRequest body PUT — sparse. service_type +
// mikrotik_profile_name TIDAK boleh diubah (composite natural key).
// Pakai pointer untuk membedakan zero value vs unset.
type BandwidthProfileUpdateRequest struct {
	Name *string `json:"name"          binding:"omitempty,min=1,max=100"`

	// Common
	RateLimit   *string `json:"rate_limit"   binding:"omitempty,max=64"`
	ParentQueue *string `json:"parent_queue" binding:"omitempty,max=100"`

	// PPPoE-only
	LocalAddress   *string `json:"local_address"   binding:"omitempty,max=100"`
	RemoteAddress  *string `json:"remote_address"  binding:"omitempty,max=100"`
	SessionTimeout *string `json:"session_timeout" binding:"omitempty,max=32"`
	IdleTimeout    *string `json:"idle_timeout"    binding:"omitempty,max=32"`

	// Hotspot-only
	AddressPool *string `json:"address_pool" binding:"omitempty,max=100"`
	SharedUsers *int    `json:"shared_users" binding:"omitempty,gte=0"`

	// Business
	PriceMonthly *int64  `json:"price_monthly" binding:"omitempty,gte=0"`
	Description  *string `json:"description"   binding:"omitempty,max=2000"`
	Active       *bool   `json:"active"`
}

// BandwidthProfileWriteResponse — body untuk POST/PUT/DELETE. `warning`
// kosong = MikroTik sync sukses (atau tidak relevan untuk operasi ini).
// Non-kosong = DB sudah ke-tulis tapi propagate ke router gagal — operator
// bisa retry dengan Sync atau update ulang.
type BandwidthProfileWriteResponse struct {
	Profile BandwidthProfileResponse `json:"profile"`
	Warning string                   `json:"warning,omitempty"`
}

// BandwidthProfileSyncResponse ringkasan hasil sync router → DB.
//   - Synced: profile yang sudah ada di kedua sisi (DB di-keep, operator
//     value tidak ditimpa selain default kosong).
//   - Created: profile router baru yang di-insert ke DB.
//   - Orphan: profile DB yang router-nya sudah hilang. Tidak otomatis
//     dihapus — operator decide via DELETE.
type BandwidthProfileSyncResponse struct {
	Synced  []string `json:"synced"`
	Created []string `json:"created"`
	Orphan  []string `json:"orphan"`
	Skipped []string `json:"skipped"`
}

// FromModelBandwidthProfile konversi model → response DTO.
func FromModelBandwidthProfile(p model.BandwidthProfile) BandwidthProfileResponse {
	return BandwidthProfileResponse{
		ID:                  p.ID,
		DeviceID:            p.DeviceID,
		ServiceType:         p.ServiceType,
		Name:                p.Name,
		MikrotikProfileName: p.MikrotikProfileName,
		RateLimit:           p.RateLimit,
		ParentQueue:         p.ParentQueue,
		LocalAddress:        p.LocalAddress,
		RemoteAddress:       p.RemoteAddress,
		SessionTimeout:      p.SessionTimeout,
		IdleTimeout:         p.IdleTimeout,
		AddressPool:         p.AddressPool,
		SharedUsers:         p.SharedUsers,
		PriceMonthly:        p.PriceMonthly,
		Description:         p.Description,
		Active:              p.Active,
		CreatedAt:           p.CreatedAt,
		UpdatedAt:           p.UpdatedAt,
	}
}
