package dto

import (
	"time"

	"github.com/quiqxiq/rosmon/store/model"
)

type PaymentResponse struct {
	ID              uint       `json:"id"`
	InvoiceID       uint       `json:"invoice_id"`
	CustomerID      uint       `json:"customer_id"`
	Amount          int64      `json:"amount"`
	Method          string     `json:"method"`
	ReferenceNumber string     `json:"reference_number,omitempty"`
	ProofURL        string     `json:"proof_url,omitempty"`
	BankName        string     `json:"bank_name,omitempty"`
	Status          string     `json:"status"`
	ConfirmedBy     *uint      `json:"confirmed_by,omitempty"`
	ConfirmedAt     *time.Time `json:"confirmed_at,omitempty"`
	RejectionReason string     `json:"rejection_reason,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type PaymentCreateRequest struct {
	InvoiceID       uint   `json:"invoice_id"       binding:"required,gt=0"`
	CustomerID      uint   `json:"customer_id"      binding:"required,gt=0"`
	Amount          int64  `json:"amount"           binding:"required,gt=0"`
	Method          string `json:"method"           binding:"required,oneof=manual_transfer cash"`
	ReferenceNumber string `json:"reference_number" binding:"max=100"`
	ProofURL        string `json:"proof_url"        binding:"max=500"`
	BankName        string `json:"bank_name"        binding:"max=100"`
}

func FromModelPayment(p model.Payment) PaymentResponse {
	return PaymentResponse{
		ID:              p.ID,
		InvoiceID:       p.InvoiceID,
		CustomerID:      p.CustomerID,
		Amount:          p.Amount,
		Method:          p.Method,
		ReferenceNumber: p.ReferenceNumber,
		ProofURL:        p.ProofURL,
		BankName:        p.BankName,
		Status:          p.Status,
		ConfirmedBy:     p.ConfirmedBy,
		ConfirmedAt:     p.ConfirmedAt,
		RejectionReason: p.RejectionReason,
		CreatedAt:       p.CreatedAt,
		UpdatedAt:       p.UpdatedAt,
	}
}
