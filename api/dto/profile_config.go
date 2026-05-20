package dto

import (
	"time"

	"github.com/quiqxiq/roslib-mikhmon/store/model"
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
	ExpiryMode string `json:"expiry_mode" binding:"required,oneof=0 rem ntf remc ntfc"`
	Validity   string `json:"validity" binding:"required"`
	Price      int    `json:"price" binding:"gte=0"`
	SellPrice  int    `json:"sell_price" binding:"gte=0"`
	LockMAC    bool   `json:"lock_mac"`
}

// FromModelProfileConfig konversi model → response DTO.
func FromModelProfileConfig(cfg model.HotspotProfileConfig) ProfileConfigResponse {
	return ProfileConfigResponse{
		ID:          cfg.ID,
		DeviceID:    cfg.DeviceID,
		ProfileName: cfg.ProfileName,
		ExpiryMode:  cfg.ExpiryMode,
		Validity:    cfg.Validity,
		Price:       cfg.Price,
		SellPrice:   cfg.SellPrice,
		LockMAC:     cfg.LockMAC,
		CreatedAt:   cfg.CreatedAt,
		UpdatedAt:   cfg.UpdatedAt,
	}
}
