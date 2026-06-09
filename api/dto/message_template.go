package dto

import (
	"time"

	"github.com/quiqxiq/rosmon/store/model"
)

// MessageTemplateResponse representasi template pesan di API response.
type MessageTemplateResponse struct {
	ID        uint      `json:"id"`
	Slug      string    `json:"slug"`
	Name      string    `json:"name"`
	Body      string    `json:"body"`
	Variables string    `json:"variables"`
	Active    bool      `json:"active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// MessageTemplateUpdateRequest body untuk PUT /message-templates/:slug.
// Slug immutable — tidak bisa diubah. Field pointer = sparse update.
type MessageTemplateUpdateRequest struct {
	Name      *string `json:"name"      binding:"omitempty,min=1,max=200"`
	Body      *string `json:"body"      binding:"omitempty,min=1"`
	Variables *string `json:"variables"`
	Active    *bool   `json:"active"`
}

// FromModelMessageTemplate konversi model → response DTO.
func FromModelMessageTemplate(m model.MessageTemplate) MessageTemplateResponse {
	return MessageTemplateResponse{
		ID:        m.ID,
		Slug:      m.Slug,
		Name:      m.Name,
		Body:      m.Body,
		Variables: m.Variables,
		Active:    m.Active,
		CreatedAt: m.CreatedAt,
		UpdatedAt: m.UpdatedAt,
	}
}
