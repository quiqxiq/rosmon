package dto

import "github.com/quiqxiq/rosmon/store/model"

// TicketResponse adalah response DTO untuk tiket.
type TicketResponse struct {
	ID           uint   `json:"id"`
	CustomerID   uint   `json:"customer_id"`
	CustomerName string `json:"customer_name,omitempty"`
	Subject      string `json:"subject"`
	Body         string `json:"body"`
	Status       string `json:"status"`
	Priority     string `json:"priority"`
	AssignedTo   *uint  `json:"assigned_to,omitempty"`
	StaffNotes   string `json:"staff_notes,omitempty"`
	ResolvedAt   string `json:"resolved_at,omitempty"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

// TicketCreateRequest adalah request body untuk membuat tiket baru.
type TicketCreateRequest struct {
	CustomerID uint   `json:"customer_id" binding:"required,gt=0"`
	Subject    string `json:"subject"     binding:"required,min=3,max=200"`
	Body       string `json:"body"`
	Priority   string `json:"priority"` // low|normal|high; default normal
}

// TicketStatusPatchRequest untuk PATCH /tickets/:id/status.
type TicketStatusPatchRequest struct {
	Status string `json:"status" binding:"required,oneof=open in_progress resolved closed"`
}

// TicketResolveRequest untuk POST /tickets/:id/resolve.
type TicketResolveRequest struct {
	StaffNotes string `json:"staff_notes"`
}

// TicketAssignRequest untuk POST /tickets/:id/assign.
type TicketAssignRequest struct {
	UserID uint `json:"user_id" binding:"required,gt=0"`
}

// FromModelTicket mengkonversi model ke DTO.
func FromModelTicket(t model.Ticket) TicketResponse {
	r := TicketResponse{
		ID:         t.ID,
		CustomerID: t.CustomerID,
		Subject:    t.Subject,
		Body:       t.Body,
		Status:     t.Status,
		Priority:   t.Priority,
		AssignedTo: t.AssignedTo,
		StaffNotes: t.StaffNotes,
		CreatedAt:  t.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:  t.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
	if t.ResolvedAt != nil {
		r.ResolvedAt = t.ResolvedAt.Format("2006-01-02T15:04:05Z07:00")
	}
	if t.Customer.ID != 0 {
		r.CustomerName = t.Customer.FullName
	}
	return r
}
