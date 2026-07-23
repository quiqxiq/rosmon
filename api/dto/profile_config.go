package dto

import (
	"time"

	"github.com/quiqxiq/rosmon/store/model"
)

// ProfileConfigResponse expose config ke client. Field Validity selalu
// dalam format RouterOS canonical ("1w", "1d2h", dst — hasil
// rosfmt.FormatDuration). Input accept Go format (`168h`) atau RouterOS
// (`7d`), tapi response selalu canonical.
type ProfileConfigResponse struct {
	ID          uint      `json:"id"`
	DeviceID    uint      `json:"device_id"`
	ProfileName string    `json:"profile_name"`
	ExpiryMode  string    `json:"expiry_mode"`
	Validity    string    `json:"validity"`
	Price       int       `json:"price"`
	SellPrice   int       `json:"sell_price"`
	LockMAC     bool      `json:"lock_mac"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ProfileConfigUpsertRequest body untuk PUT /devices/{id}/hotspot/profile-configs/{name}.
// ExpiryMode enum: 0 (none) | rem (remove) | ntf (notice) | remc (remove+record) | ntfc (notice+record).
type ProfileConfigUpsertRequest struct {
	ExpiryMode string `json:"expiry_mode" binding:"required,oneof=0 none rem ntf remc ntfc"`
	Validity   string `json:"validity" binding:"required"`
	Price      int    `json:"price" binding:"gte=0"`
	SellPrice  int    `json:"sell_price" binding:"gte=0"`
	LockMAC    bool   `json:"lock_mac"`
}

// FromModelHotspotProfileConfig konversi model.HotspotProfile (role=voucher) → ProfileConfigResponse.
// Mempertahankan API contract /hotspot/profile-configs yang existing.
func FromModelHotspotProfileConfig(p model.HotspotProfile) ProfileConfigResponse {
	return ProfileConfigResponse{
		ID:          p.ID,
		DeviceID:    p.DeviceID,
		ProfileName: p.Name,
		ExpiryMode:  p.ExpiryMode,
		Validity:    p.Validity,
		Price:       p.Price,
		SellPrice:   p.SellPrice,
		LockMAC:     p.LockMAC,
		CreatedAt:   p.CreatedAt,
		UpdatedAt:   p.UpdatedAt,
	}
}

// ProfileConfigSyncResponse adalah ringkasan hasil sync profile router → DB.
//
//   - Synced: profile yang sudah ada di DB (tidak ditimpa, operator value
//     dipertahankan).
//   - Created: profile router baru yang di-insert dengan default
//     ExpiryMode="0", Price=0. Operator perlu PUT untuk set price/mode.
//   - Orphan: config DB yang profile-nya sudah hilang dari router.
//     Tidak dihapus otomatis — operator yang putuskan via DELETE.
//   - Injected: profile yang on-login script-nya berhasil di-push ke router.
//   - InjectFailed: profile yang gagal di-inject (router error, dsb),
//     biasanya berisi pesan ringkas "<profile>: <error>". Tidak fatal.
type ProfileConfigSyncResponse struct {
	Synced       []string `json:"synced"`
	Created      []string `json:"created"`
	Orphan       []string `json:"orphan"`
	Injected     []string `json:"injected"`
	InjectFailed []string `json:"inject_failed"`
	Skipped      []string `json:"skipped"`
}
