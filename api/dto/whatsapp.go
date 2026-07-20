package dto

// WhatsAppStatusResponse status koneksi gateway WhatsApp.
type WhatsAppStatusResponse struct {
	Connected bool   `json:"connected"`
	JID       string `json:"jid,omitempty"`
}

// WhatsAppQRResponse memuat QR code mentah untuk pairing (frontend render
// jadi gambar).
type WhatsAppQRResponse struct {
	Code string `json:"code"`
}

// WhatsAppPairPhoneRequest body untuk POST /whatsapp/pair-phone.
type WhatsAppPairPhoneRequest struct {
	Phone string `json:"phone" binding:"required,min=3,max=20"`
}

// WhatsAppPairPhoneResponse response dari POST /whatsapp/pair-phone.
type WhatsAppPairPhoneResponse struct {
	Code string `json:"code"`
}

// WhatsAppTestRequest body untuk POST /whatsapp/test.
type WhatsAppTestRequest struct {
	Phone   string `json:"phone"   binding:"required,min=3,max=20"`
	Message string `json:"message" binding:"required,min=1,max=1000"`
}
