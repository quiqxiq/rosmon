package dto

import (
	"time"

	"github.com/quiqxiq/rosmon/store/model"
)

// NotificationLogResponse representasi jejak notifikasi di API response
// (admin only). ProviderResponse sengaja tidak di-expose.
type NotificationLogResponse struct {
	ID             uint       `json:"id"`
	CustomerID     *uint      `json:"customer_id,omitempty"`
	TemplateSlug   string     `json:"template_slug"`
	RecipientPhone string     `json:"recipient_phone"`
	MessageBody    string     `json:"message_body"`
	Status         string     `json:"status"`
	Provider       string     `json:"provider,omitempty"`
	RetryCount     int        `json:"retry_count"`
	SentAt         *time.Time `json:"sent_at,omitempty"`
	NextRetryAt    *time.Time `json:"next_retry_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

// FromModelNotificationLog konversi model → response DTO.
func FromModelNotificationLog(m model.NotificationLog) NotificationLogResponse {
	return NotificationLogResponse{
		ID:             m.ID,
		CustomerID:     m.CustomerID,
		TemplateSlug:   m.TemplateSlug,
		RecipientPhone: m.RecipientPhone,
		MessageBody:    m.MessageBody,
		Status:         m.Status,
		Provider:       m.Provider,
		RetryCount:     m.RetryCount,
		SentAt:         m.SentAt,
		NextRetryAt:    m.NextRetryAt,
		CreatedAt:      m.CreatedAt,
	}
}
