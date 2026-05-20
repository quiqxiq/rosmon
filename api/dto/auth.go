package dto

import (
	"time"

	"github.com/quiqxiq/roslib-mikhmon/store/model"
)

// LoginRequest body untuk POST /auth/login.
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// RefreshRequest body untuk POST /auth/refresh.
type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// LogoutRequest body untuk POST /auth/logout (idempotent — error tetap 200).
type LogoutRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// TokenResponse balasan untuk login/refresh.
type TokenResponse struct {
	AccessToken      string    `json:"access_token"`
	RefreshToken     string    `json:"refresh_token"`
	TokenType        string    `json:"token_type"`
	ExpiresIn        int       `json:"expires_in"` // detik
	AccessExpiresAt  time.Time `json:"access_expires_at"`
	RefreshExpiresAt time.Time `json:"refresh_expires_at"`
	User             UserResponse `json:"user"`
}

// UserResponse di-expose ke client — password tidak di-include.
type UserResponse struct {
	ID        uint      `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email,omitempty"`
	Role      string    `json:"role"`
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UserCreateRequest body untuk POST /auth/users (admin only).
type UserCreateRequest struct {
	Username string `json:"username" binding:"required,min=3,max=64"`
	Email    string `json:"email,omitempty" binding:"omitempty,email"`
	Password string `json:"password" binding:"required,min=8"`
	Role     string `json:"role" binding:"required,oneof=admin operator viewer"`
	Active   *bool  `json:"active,omitempty"`
}

// UserUpdateRequest body untuk PUT /auth/users/:id. Semua field optional;
// kalau nil → jangan ubah.
type UserUpdateRequest struct {
	Email    *string `json:"email,omitempty"`
	Password *string `json:"password,omitempty" binding:"omitempty,min=8"`
	Role     *string `json:"role,omitempty" binding:"omitempty,oneof=admin operator viewer"`
	Active   *bool   `json:"active,omitempty"`
}

// MeResponse — body /auth/me. Mirror UserResponse tanpa field admin-only.
type MeResponse struct {
	UserResponse
}

// FromModelUser konversi model.User → UserResponse.
func FromModelUser(u model.User) UserResponse {
	return UserResponse{
		ID:        u.ID,
		Username:  u.Username,
		Email:     u.Email,
		Role:      u.Role,
		Active:    u.Active,
		CreatedAt: u.CreatedAt,
		UpdatedAt: u.UpdatedAt,
	}
}
