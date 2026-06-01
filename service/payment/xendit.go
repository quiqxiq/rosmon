package payment

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// XenditAdapter mengimplementasikan Gateway menggunakan Xendit Invoice API v2.
//
// Autentikasi: Basic Auth dengan secret_key sebagai username, password kosong.
// Webhook: verifikasi via header "x-callback-token" (token dari dashboard Xendit).
//
// Referensi:
//   - https://developers.xendit.co/api-reference/#create-invoice
//   - https://developers.xendit.co/api-reference/#invoice-callback
type XenditAdapter struct {
	secretKey       string
	webhookToken    string // X-CALLBACK-TOKEN dari dashboard Xendit Settings → Webhooks
	invoiceDuration int    // detik, default 86400 (24 jam)
	baseURL         string // override untuk testing; default "https://api.xendit.co"
}

// NewXenditAdapter membuat adapter Xendit baru.
// secretKey dan webhookToken TIDAK boleh kosong di production.
// invoiceDurationSec = 0 → pakai default 86400.
func NewXenditAdapter(secretKey, webhookToken string, invoiceDurationSec int) *XenditAdapter {
	if invoiceDurationSec <= 0 {
		invoiceDurationSec = 86400
	}
	return &XenditAdapter{
		secretKey:       secretKey,
		webhookToken:    webhookToken,
		invoiceDuration: invoiceDurationSec,
		baseURL:         "https://api.xendit.co",
	}
}

func (a *XenditAdapter) Name() string { return "xendit" }

// Ping melakukan test koneksi ke Xendit API menggunakan secret key yang dikonfigurasi.
// Menggunakan GET /v2/invoices?limit=1 — call ringan tanpa side effect.
func (a *XenditAdapter) Ping(ctx context.Context) error {
	if a.secretKey == "" {
		return fmt.Errorf("secret key tidak dikonfigurasi")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet,
		a.baseURL+"/v2/invoices?limit=1", nil)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	req.SetBasicAuth(a.secretKey, "")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("http error: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return fmt.Errorf("autentikasi gagal — periksa secret key")
	}
	if resp.StatusCode >= 500 {
		return fmt.Errorf("Xendit server error (HTTP %d)", resp.StatusCode)
	}
	return nil
}

// xenditInvoicePayload adalah payload POST /v2/invoices.
type xenditInvoicePayload struct {
	ExternalID      string            `json:"external_id"`
	Amount          int64             `json:"amount"`
	Description     string            `json:"description"`
	InvoiceDuration int               `json:"invoice_duration"`
	Customer        xenditCustomer    `json:"customer"`
	CustomerNotif   xenditCustomerNotif `json:"customer_notification_preference"`
	SuccessURL      string            `json:"success_redirect_url"`
	FailureURL      string            `json:"failure_redirect_url"`
	Currency        string            `json:"currency"`
	Items           []xenditItem      `json:"items"`
}

type xenditCustomer struct {
	GivenNames   string `json:"given_names"`
	Email        string `json:"email"`
	MobileNumber string `json:"mobile_number,omitempty"`
}

type xenditCustomerNotif struct {
	InvoiceCreated []string `json:"invoice_created,omitempty"`
	InvoicePaid    []string `json:"invoice_paid,omitempty"`
}

type xenditItem struct {
	Name     string `json:"name"`
	Quantity int    `json:"quantity"`
	Price    int64  `json:"price"`
}

// xenditInvoiceResponse adalah response Xendit POST /v2/invoices.
type xenditInvoiceResponse struct {
	ID         string `json:"id"`
	InvoiceURL string `json:"invoice_url"`
	ExpiryDate string `json:"expiry_date"` // ISO8601
	Status     string `json:"status"`
	// tambahan field lain diabaikan
}

func (a *XenditAdapter) CreateInvoice(ctx context.Context, req CreateInvoiceRequest) (CreateInvoiceResult, error) {
	if a.secretKey == "" {
		return CreateInvoiceResult{}, fmt.Errorf("xendit: secret key tidak dikonfigurasi")
	}

	email := req.CustomerEmail
	if email == "" {
		digits := strings.Map(func(r rune) rune {
			if r >= '0' && r <= '9' {
				return r
			}
			return -1
		}, req.CustomerPhone)
		email = fmt.Sprintf("cust%s@noreply.local", digits)
	}

	duration := req.InvoiceDuration
	if duration <= 0 {
		duration = a.invoiceDuration
	}

	// Normalisasi nomor ke format E.164 (628xxx).
	phone := normalizePhone(req.CustomerPhone)

	payload := xenditInvoicePayload{
		ExternalID:      req.ExternalID,
		Amount:          req.Amount,
		Description:     req.Description,
		InvoiceDuration: duration,
		Customer: xenditCustomer{
			GivenNames:   req.CustomerName,
			Email:        email,
			MobileNumber: phone,
		},
		CustomerNotif: xenditCustomerNotif{
			InvoiceCreated: []string{"email", "whatsapp"},
			InvoicePaid:    []string{"email", "whatsapp"},
		},
		SuccessURL: req.SuccessURL,
		FailureURL: req.FailureURL,
		Currency:   "IDR",
		Items: []xenditItem{
			{Name: req.Description, Quantity: 1, Price: req.Amount},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return CreateInvoiceResult{}, fmt.Errorf("xendit: marshal payload: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
		a.baseURL+"/v2/invoices", strings.NewReader(string(body)))
	if err != nil {
		return CreateInvoiceResult{}, fmt.Errorf("xendit: build request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.SetBasicAuth(a.secretKey, "")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return CreateInvoiceResult{}, fmt.Errorf("xendit: http request: %w", err)
	}
	defer resp.Body.Close()

	var rawMap map[string]json.RawMessage
	if decErr := json.NewDecoder(resp.Body).Decode(&rawMap); decErr != nil {
		return CreateInvoiceResult{}, fmt.Errorf("xendit: decode response: %w", decErr)
	}
	rawBytes, _ := json.Marshal(rawMap)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		errMsg := string(rawBytes)
		return CreateInvoiceResult{}, fmt.Errorf("xendit: HTTP %d: %s", resp.StatusCode, errMsg)
	}

	var inv xenditInvoiceResponse
	if err := json.Unmarshal(rawBytes, &inv); err != nil {
		return CreateInvoiceResult{}, fmt.Errorf("xendit: decode invoice response: %w", err)
	}

	expiresAt := time.Now().Add(time.Duration(duration) * time.Second)
	if inv.ExpiryDate != "" {
		if t, parseErr := time.Parse(time.RFC3339, inv.ExpiryDate); parseErr == nil {
			expiresAt = t
		}
	}

	return CreateInvoiceResult{
		ExternalRef: inv.ID,
		InvoiceURL:  inv.InvoiceURL,
		ExpiresAt:   expiresAt,
		RawResponse: string(rawBytes),
	}, nil
}

// VerifyWebhookSignature memvalidasi header "x-callback-token" dari request Xendit.
// Xendit mengirim token plaintext, bukan HMAC — cukup compare string.
func (a *XenditAdapter) VerifyWebhookSignature(_ []byte, headers map[string]string) error {
	token := headers["x-callback-token"]
	if a.webhookToken == "" {
		// Jika webhook token tidak dikonfigurasi, skip verifikasi (dev mode).
		// Logging sebaiknya dilakukan oleh pemanggil.
		return nil
	}
	if token != a.webhookToken {
		return fmt.Errorf("xendit: invalid callback token")
	}
	return nil
}

// xenditWebhookBody adalah subset field dari Xendit invoice callback payload.
type xenditWebhookBody struct {
	ID         string  `json:"id"`          // external_id
	PaymentID  string  `json:"payment_id"`  // Xendit invoice ID (sama dengan ExternalRef)
	ExternalID string  `json:"external_id"` // external_id yang kita kirim saat CreateInvoice
	Status     string  `json:"status"`      // PAID | EXPIRED | FAILED
	Amount     float64 `json:"amount"`
	PaidAt     string  `json:"paid_at"` // ISO8601
}

// ParseWebhookEvent mem-parse Xendit invoice callback menjadi PaymentEvent.
func (a *XenditAdapter) ParseWebhookEvent(rawBody []byte) (PaymentEvent, error) {
	var wb xenditWebhookBody
	if err := json.Unmarshal(rawBody, &wb); err != nil {
		return PaymentEvent{}, fmt.Errorf("xendit: parse webhook: %w", err)
	}

	// ExternalRef = Xendit invoice ID (bukan external_id kita).
	// Kita menyimpan ExternalRef = Xendit invoice "id" saat CreateInvoice.
	externalRef := wb.PaymentID
	if externalRef == "" {
		externalRef = wb.ID // fallback
	}

	status := strings.ToLower(wb.Status)
	switch status {
	case "paid":
		status = "paid"
	case "expired":
		status = "expired"
	default:
		status = "failed"
	}

	evt := PaymentEvent{
		ExternalRef: externalRef,
		Status:      status,
		Amount:      int64(wb.Amount),
		GatewayName: "xendit",
	}
	if wb.PaidAt != "" {
		if t, err := time.Parse(time.RFC3339, wb.PaidAt); err == nil {
			evt.PaidAt = &t
		}
	}
	return evt, nil
}

// normalizePhone menormalisasi nomor telepon ke format E.164 (contoh: 628123456789).
func normalizePhone(phone string) string {
	digits := strings.Map(func(r rune) rune {
		if r >= '0' && r <= '9' {
			return r
		}
		return -1
	}, phone)
	if strings.HasPrefix(digits, "0") {
		return "62" + digits[1:]
	}
	if !strings.HasPrefix(digits, "62") {
		return "62" + digits
	}
	return digits
}
