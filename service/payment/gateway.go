// Package payment menyediakan abstraksi payment gateway dan service layer
// untuk inisiasi pembayaran online (Xendit, Tripay, dll.).
//
// Arsitektur:
//   - Gateway interface: adapter per-provider (xendit.go, tripay.go, dsb.)
//   - Service: orkestrasi — buat Payment record di DB, panggil gateway, kembalikan URL.
//   - Webhook: handler publik memanggil applySettlement (di api/handler/payments.go).
package payment

import (
	"context"
	"time"
)

// Gateway adalah abstraksi adapter payment gateway.
// Satu implementasi per provider: XenditAdapter, TripayAdapter, dsb.
type Gateway interface {
	// Name mengembalikan identifier provider, contoh: "xendit", "tripay".
	Name() string

	// CreateInvoice membuat link pembayaran di sisi gateway.
	// ExternalID dipakai sebagai idempotency key di gateway.
	CreateInvoice(ctx context.Context, req CreateInvoiceRequest) (CreateInvoiceResult, error)

	// VerifyWebhookSignature memvalidasi bahwa request webhook berasal dari gateway.
	// headers adalah semua HTTP header dari request webhook (key lowercase).
	// Mengembalikan error jika signature tidak valid.
	VerifyWebhookSignature(rawBody []byte, headers map[string]string) error

	// ParseWebhookEvent mem-parse body webhook menjadi PaymentEvent standar.
	ParseWebhookEvent(rawBody []byte) (PaymentEvent, error)
}

// CreateInvoiceRequest adalah input standar untuk semua gateway.
type CreateInvoiceRequest struct {
	// ExternalID dipakai sebagai idempotency key di sisi gateway.
	// Format: "xendit-<invoice_id>-<payment_id>" agar unik dan traceable.
	ExternalID string

	Amount      int64
	Description string

	CustomerName  string
	CustomerPhone string // format E.164 (628xxx)
	CustomerEmail string // fallback: cust<phone>@noreply.local

	// Redirect URL setelah pembayaran selesai/gagal.
	SuccessURL string
	FailureURL string

	// InvoiceDuration adalah lama link berlaku dalam detik.
	// Default 86400 (24 jam) jika 0.
	InvoiceDuration int
}

// CreateInvoiceResult adalah hasil dari CreateInvoice.
type CreateInvoiceResult struct {
	// ExternalRef adalah ID unik transaksi di sisi gateway (Xendit invoice ID, dsb.).
	// Dipakai untuk lookup saat webhook datang.
	ExternalRef string

	// InvoiceURL adalah URL checkout yang diarahkan ke pelanggan.
	InvoiceURL string

	// ExpiresAt adalah waktu kadaluarsa link.
	ExpiresAt time.Time

	// RawResponse adalah raw JSON response dari gateway untuk keperluan audit.
	RawResponse string
}

// PaymentEvent adalah event standar dari webhook gateway (provider-agnostic).
type PaymentEvent struct {
	// ExternalRef adalah ID transaksi di sisi gateway (sama dengan CreateInvoiceResult.ExternalRef).
	ExternalRef string

	// Status: "paid" | "expired" | "failed"
	Status string

	Amount int64
	PaidAt *time.Time

	// GatewayName adalah nama provider ("xendit", "tripay", dsb.).
	GatewayName string
}
