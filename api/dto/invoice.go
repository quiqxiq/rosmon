package dto

import (
	"time"

	"github.com/quiqxiq/rosmon/store/model"
)

type InvoiceResponse struct {
	ID             uint       `json:"id"`
	InvoiceNumber  string     `json:"invoice_number"`
	CustomerID     uint       `json:"customer_id"`
	SubscriptionID uint       `json:"subscription_id"`
	Amount         int64      `json:"amount"`
	PeriodStart    time.Time  `json:"period_start"`
	PeriodEnd      time.Time  `json:"period_end"`
	DueDate        time.Time  `json:"due_date"`
	Status         string     `json:"status"`
	IssuedAt       *time.Time `json:"issued_at,omitempty"`
	PaidAt         *time.Time `json:"paid_at,omitempty"`
	Notes          string     `json:"notes,omitempty"`
	// PaymentCode + QRContent: kode bayar unik + isi QR (di-render sisi-klien).
	// Hanya relevan untuk invoice belum lunas.
	PaymentCode string    `json:"payment_code,omitempty"`
	QRContent   string    `json:"qr_content,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// PaymentCodeQR membentuk isi QR dari kode bayar. Format URI sederhana yang
// bisa di-encode jadi QR dan dipindai petugas (lalu di-input ke settle-by-code).
func PaymentCodeQR(code string) string {
	if code == "" {
		return ""
	}
	return "rosmon-pay:" + code
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
		PaymentCode:    inv.PaymentCode,
		QRContent:      PaymentCodeQR(inv.PaymentCode),
		CreatedAt:      inv.CreatedAt,
		UpdatedAt:      inv.UpdatedAt,
	}
}
