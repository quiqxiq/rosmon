package dto

import (
	"time"

	"github.com/quiqxiq/rosmon/store/model"
)

type PPPProfileResponse struct {
	ID             uint      `json:"id"`
	DeviceID       uint      `json:"device_id"`
	Name           string    `json:"name"`
	RateLimit      string    `json:"rate_limit"`
	LocalAddress   string    `json:"local_address"`
	RemoteAddress  string    `json:"remote_address"`
	SessionTimeout string    `json:"session_timeout"`
	IdleTimeout    string    `json:"idle_timeout"`
	ParentQueue    string    `json:"parent_queue"`
	PriceMonthly   int64     `json:"price_monthly"`
	Description    string    `json:"description"`
	Active         bool      `json:"active"`
	IsPublic       bool      `json:"is_public"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type PPPProfileCreateRequest struct {
	Name           string `json:"name"            binding:"required,min=1,max=100"`
	RateLimit      string `json:"rate_limit"      binding:"max=64"`
	LocalAddress   string `json:"local_address"   binding:"max=64"`
	RemoteAddress  string `json:"remote_address"  binding:"max=64"`
	SessionTimeout string `json:"session_timeout" binding:"max=32"`
	IdleTimeout    string `json:"idle_timeout"    binding:"max=32"`
	ParentQueue    string `json:"parent_queue"    binding:"max=64"`
	PriceMonthly   int64  `json:"price_monthly"   binding:"gte=0"`
	Description    string `json:"description"     binding:"max=2000"`
	Active         *bool  `json:"active"`
	IsPublic       *bool  `json:"is_public"`
}

type PPPProfileUpdateRequest struct {
	Name           *string `json:"name"            binding:"omitempty,min=1,max=100"`
	RateLimit      *string `json:"rate_limit"      binding:"omitempty,max=64"`
	LocalAddress   *string `json:"local_address"   binding:"omitempty,max=64"`
	RemoteAddress  *string `json:"remote_address"  binding:"omitempty,max=64"`
	SessionTimeout *string `json:"session_timeout" binding:"omitempty,max=32"`
	IdleTimeout    *string `json:"idle_timeout"    binding:"omitempty,max=32"`
	ParentQueue    *string `json:"parent_queue"    binding:"omitempty,max=64"`
	PriceMonthly   *int64  `json:"price_monthly"   binding:"omitempty,gte=0"`
	Description    *string `json:"description"     binding:"omitempty,max=2000"`
	Active         *bool   `json:"active"`
	IsPublic       *bool   `json:"is_public"`
}

type PPPProfileWriteResponse struct {
	Profile PPPProfileResponse `json:"profile"`
	Warning string             `json:"warning,omitempty"`
}

type PPPProfileSyncResponse struct {
	Synced  []string `json:"synced"`
	Created []string `json:"created"`
	Orphan  []string `json:"orphan"`
}

func FromModelPPPProfile(p model.PPPProfile) PPPProfileResponse {
	return PPPProfileResponse{
		ID:             p.ID,
		DeviceID:       p.DeviceID,
		Name:           p.Name,
		RateLimit:      p.RateLimit,
		LocalAddress:   p.LocalAddress,
		RemoteAddress:  p.RemoteAddress,
		SessionTimeout: p.SessionTimeout,
		IdleTimeout:    p.IdleTimeout,
		ParentQueue:    p.ParentQueue,
		PriceMonthly:   p.PriceMonthly,
		Description:    p.Description,
		Active:         p.Active,
		IsPublic:       p.IsPublic,
		CreatedAt:      p.CreatedAt,
		UpdatedAt:      p.UpdatedAt,
	}
}
