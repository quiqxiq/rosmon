package dto

import (
	"time"

	"github.com/quiqxiq/rosmon/store/model"
)

type HotspotProfileResponse struct {
	ID                uint      `json:"id"`
	DeviceID          uint      `json:"device_id"`
	Name              string    `json:"name"`
	Role              string    `json:"role"`
	RateLimit         string    `json:"rate_limit"`
	AddressPool       string    `json:"address_pool"`
	SharedUsers       int       `json:"shared_users"`
	StatusAutorefresh string    `json:"status_autorefresh"`
	ParentQueue       string    `json:"parent_queue"`
	PriceMonthly      int64     `json:"price_monthly,omitempty"`
	ExpiryMode        string    `json:"expiry_mode,omitempty"`
	Validity          string    `json:"validity,omitempty"`
	Price             int       `json:"price,omitempty"`
	SellPrice         int       `json:"sell_price,omitempty"`
	LockMAC           bool      `json:"lock_mac,omitempty"`
	Description       string    `json:"description"`
	Active            bool      `json:"active"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type HotspotProfileCreateRequest struct {
	Name              string `json:"name"               binding:"required,min=1,max=100"`
	Role              string `json:"role"               binding:"required,oneof=permanent voucher"`
	RateLimit         string `json:"rate_limit"         binding:"max=64"`
	AddressPool       string `json:"address_pool"       binding:"max=64"`
	SharedUsers       int    `json:"shared_users"       binding:"gte=0"`
	StatusAutorefresh string `json:"status_autorefresh" binding:"max=16"`
	ParentQueue       string `json:"parent_queue"       binding:"max=64"`
	PriceMonthly      int64  `json:"price_monthly"      binding:"gte=0"`
	ExpiryMode        string `json:"expiry_mode"   binding:"omitempty,oneof=0 rem ntf remc ntfc"`
	Validity          string `json:"validity"      binding:"max=16"`
	Price             int    `json:"price"         binding:"gte=0"`
	SellPrice         int    `json:"sell_price"    binding:"gte=0"`
	LockMAC           bool   `json:"lock_mac"`
	Description       string `json:"description"   binding:"max=2000"`
	Active            *bool  `json:"active"`
}

type HotspotProfileUpdateRequest struct {
	Name              *string `json:"name"               binding:"omitempty,min=1,max=100"`
	RateLimit         *string `json:"rate_limit"         binding:"omitempty,max=64"`
	AddressPool       *string `json:"address_pool"       binding:"omitempty,max=64"`
	SharedUsers       *int    `json:"shared_users"       binding:"omitempty,gte=0"`
	StatusAutorefresh *string `json:"status_autorefresh" binding:"omitempty,max=16"`
	ParentQueue       *string `json:"parent_queue"       binding:"omitempty,max=64"`
	PriceMonthly      *int64  `json:"price_monthly"      binding:"omitempty,gte=0"`
	ExpiryMode        *string `json:"expiry_mode"   binding:"omitempty,oneof=0 rem ntf remc ntfc"`
	Validity          *string `json:"validity"      binding:"omitempty,max=16"`
	Price             *int    `json:"price"         binding:"omitempty,gte=0"`
	SellPrice         *int    `json:"sell_price"    binding:"omitempty,gte=0"`
	LockMAC           *bool   `json:"lock_mac"`
	Description       *string `json:"description"   binding:"omitempty,max=2000"`
	Active            *bool   `json:"active"`
}

type HotspotProfileWriteResponse struct {
	Profile HotspotProfileResponse `json:"profile"`
	Warning string                 `json:"warning,omitempty"`
}

type HotspotProfileSyncResponse struct {
	Synced  []string `json:"synced"`
	Created []string `json:"created"`
	Orphan  []string `json:"orphan"`
}

func FromModelHotspotProfile(p model.HotspotProfile) HotspotProfileResponse {
	return HotspotProfileResponse{
		ID:                p.ID,
		DeviceID:          p.DeviceID,
		Name:              p.Name,
		Role:              p.Role,
		RateLimit:         p.RateLimit,
		AddressPool:       p.AddressPool,
		SharedUsers:       p.SharedUsers,
		StatusAutorefresh: p.StatusAutorefresh,
		ParentQueue:       p.ParentQueue,
		PriceMonthly:      p.PriceMonthly,
		ExpiryMode:        p.ExpiryMode,
		Validity:          p.Validity,
		Price:             p.Price,
		SellPrice:         p.SellPrice,
		LockMAC:           p.LockMAC,
		Description:       p.Description,
		Active:            p.Active,
		CreatedAt:         p.CreatedAt,
		UpdatedAt:         p.UpdatedAt,
	}
}
