package dto

import (
	"time"

	"github.com/quiqxiq/rosmon/store/model"
)

// PaymentResponse digunakan untuk response daftar/detail pembayaran (staff & portal).
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
	// Gateway fields (isi hanya untuk pembayaran online via gateway).
	GatewayName string     `json:"gateway_name,omitempty"`
	InvoiceURL  string     `json:"invoice_url,omitempty"`
	ExpiresAt   *time.Time `json:"expires_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// PaymentCreateRequest untuk pembayaran manual (transfer/cash) oleh staff.
type PaymentCreateRequest struct {
	InvoiceID       uint   `json:"invoice_id"       binding:"required,gt=0"`
	CustomerID      uint   `json:"customer_id"      binding:"required,gt=0"`
	Amount          int64  `json:"amount"           binding:"required,gt=0"`
	Method          string `json:"method"           binding:"required,oneof=manual_transfer cash"`
	ReferenceNumber string `json:"reference_number" binding:"max=100"`
	ProofURL        string `json:"proof_url"        binding:"max=500"`
	BankName        string `json:"bank_name"        binding:"max=100"`
}

// InitiatePaymentResponse adalah response untuk POST /customer/invoices/:id/pay.
// Berisi link checkout gateway untuk redirect pelanggan.
type InitiatePaymentResponse struct {
	PaymentID  uint   `json:"payment_id"`
	InvoiceURL string `json:"invoice_url"`
	ExpiresAt  string `json:"expires_at"` // RFC3339
}

func FromModelPayment(p model.Payment) PaymentResponse {
	r := PaymentResponse{
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
		GatewayName:     p.GatewayName,
		InvoiceURL:      p.InvoiceURL,
		ExpiresAt:       p.ExpiresAt,
		CreatedAt:       p.CreatedAt,
		UpdatedAt:       p.UpdatedAt,
	}
	return r
}
