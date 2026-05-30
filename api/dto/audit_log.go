package dto

import (
	"time"

	"github.com/quiqxiq/rosmon/store/model"
)

// AuditLogResponse representasi audit log di API response (admin only).
type AuditLogResponse struct {
	ID         uint      `json:"id"`
	UserID     *uint     `json:"user_id,omitempty"`
	Action     string    `json:"action"`
	EntityType string    `json:"entity_type"`
	EntityID   *uint     `json:"entity_id,omitempty"`
	OldValues  string    `json:"old_values,omitempty"`
	NewValues  string    `json:"new_values,omitempty"`
	IPAddress  string    `json:"ip_address,omitempty"`
	Notes      string    `json:"notes,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

// FromModelAuditLog konversi model → response DTO.
func FromModelAuditLog(m model.AuditLog) AuditLogResponse {
	return AuditLogResponse{
		ID:         m.ID,
		UserID:     m.UserID,
		Action:     m.Action,
		EntityType: m.EntityType,
		EntityID:   m.EntityID,
		OldValues:  m.OldValues,
		NewValues:  m.NewValues,
		IPAddress:  m.IPAddress,
		Notes:      m.Notes,
		CreatedAt:  m.CreatedAt,
	}
}
