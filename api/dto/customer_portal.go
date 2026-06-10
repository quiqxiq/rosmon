package dto

import "github.com/quiqxiq/rosmon/store/model"

// PaymentCollectRequest — body POST /payments/collect (settle-by-code, petugas).
type PaymentCollectRequest struct {
	Code   string `json:"code"   binding:"required,min=4,max=32"`
	Method string `json:"method" binding:"omitempty,oneof=cash transfer"`
}

// CustomerLoginRequest — body POST /api/customer/login.
type CustomerLoginRequest struct {
	Phone    string `json:"phone"    binding:"required,min=3,max=20"`
	Password string `json:"password" binding:"required,min=1,max=128"`
}

// CustomerLoginResponse — hasil login portal pelanggan.
type CustomerLoginResponse struct {
	AccessToken string             `json:"access_token"`
	TokenType   string             `json:"token_type"`
	ExpiresIn   int                `json:"expires_in"` // detik
	Customer    CustomerMeResponse `json:"customer"`
}

// CustomerMeResponse — profil pelanggan (tanpa field sensitif).
type CustomerMeResponse struct {
	ID       uint   `json:"id"`
	FullName string `json:"full_name"`
	Phone    string `json:"phone"`
	Address  string `json:"address"`
	Area     string `json:"area"`
	Status   string `json:"status"`
}

// ChangePasswordRequest — body POST /api/customer/change-password.
type ChangePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required,min=1,max=128"`
	NewPassword string `json:"new_password" binding:"required,min=8,max=128"`
}

// SetPortalPasswordRequest — body POST /customers/:id/portal-password (admin).
type SetPortalPasswordRequest struct {
	Password string `json:"password" binding:"required,min=8,max=128"`
}

// FromModelCustomerMe konversi model → profil portal (tanpa hash).
func FromModelCustomerMe(c model.Customer) CustomerMeResponse {
	return CustomerMeResponse{
		ID:       c.ID,
		FullName: c.FullName,
		Phone:    c.Phone,
		Address:  c.Address,
		Area:     c.Area,
		Status:   c.Status,
	}
}
