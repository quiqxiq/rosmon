package dto

import (
	"time"

	"github.com/quiqxiq/rosmon/store/model"
)

// CustomerResponse adalah representasi customer di API response.
type CustomerResponse struct {
	ID        uint      `json:"id"`
	FullName  string    `json:"full_name"`
	Phone     string    `json:"phone"`
	Address   string    `json:"address"`
	Area      string    `json:"area"`
	Notes     string    `json:"notes"`
	Status    string    `json:"status"`
	CreatedBy *uint     `json:"created_by,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CustomerCreateRequest body untuk POST /customers.
type CustomerCreateRequest struct {
	FullName string `json:"full_name" binding:"required,min=1,max=200"`
	Phone    string `json:"phone"     binding:"required,min=3,max=20"`
	Address  string `json:"address"   binding:"max=2000"`
	Area     string `json:"area"      binding:"max=100"`
	Notes    string `json:"notes"     binding:"max=2000"`
	Status   string `json:"status"    binding:"omitempty,oneof=aktif nonaktif"`
}

// CustomerUpdateRequest body untuk PUT /customers/:id. Field opsional
// (pointer = sparse update). Nil pointer = jangan ubah.
type CustomerUpdateRequest struct {
	FullName *string `json:"full_name" binding:"omitempty,min=1,max=200"`
	Phone    *string `json:"phone"     binding:"omitempty,min=3,max=20"`
	Address  *string `json:"address"   binding:"omitempty,max=2000"`
	Area     *string `json:"area"      binding:"omitempty,max=100"`
	Notes    *string `json:"notes"     binding:"omitempty,max=2000"`
	Status   *string `json:"status"    binding:"omitempty,oneof=aktif nonaktif"`
}

// FromModelCustomer konversi model → response DTO.
func FromModelCustomer(c model.Customer) CustomerResponse {
	return CustomerResponse{
		ID:        c.ID,
		FullName:  c.FullName,
		Phone:     c.Phone,
		Address:   c.Address,
		Area:      c.Area,
		Notes:     c.Notes,
		Status:    c.Status,
		CreatedBy: c.CreatedBy,
		CreatedAt: c.CreatedAt,
		UpdatedAt: c.UpdatedAt,
	}
}
