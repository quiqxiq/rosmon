package dto

import (
	"time"

	"github.com/quiqxiq/rosmon/store/model"
)

type InvoiceResponse struct {
	ID             uint      `json:"id"`
	InvoiceNumber  string    `json:"invoice_number"`
	CustomerID     uint      `json:"customer_id"`
	SubscriptionID uint      `json:"subscription_id"`
	Amount         int64     `json:"amount"`
	PeriodStart    time.Time `json:"period_start"`
	PeriodEnd      time.Time `json:"period_end"`
	DueDate        time.Time `json:"due_date"`
	Status         string    `json:"status"`
	IssuedAt       *time.Time `json:"issued_at,omitempty"`
	PaidAt         *time.Time `json:"paid_at,omitempty"`
	Notes          string    `json:"notes,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func FromModelInvoice(inv model.Invoice) InvoiceResponse {
	return InvoiceResponse{
		ID:             inv.ID,
		InvoiceNumber:  inv.InvoiceNumber,
		CustomerID:     inv.CustomerID,
		SubscriptionID: inv.SubscriptionID,
		Amount:         inv.Amount,
		PeriodStart:    inv.PeriodStart,
		PeriodEnd:      inv.PeriodEnd,
		DueDate:        inv.DueDate,
		Status:         inv.Status,
		IssuedAt:       inv.IssuedAt,
		PaidAt:         inv.PaidAt,
		Notes:          inv.Notes,
		CreatedAt:      inv.CreatedAt,
		UpdatedAt:      inv.UpdatedAt,
	}
}
