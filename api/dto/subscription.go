package dto

import (
	"time"

	"github.com/quiqxiq/rosmon/store/model"
)

// SubscriptionResponse — API representation. MikrotikPassword sengaja
// TIDAK di-expose; password hanya disimpan di DB (encrypted) dan dikirim
// ke router saat provision. Operator yang butuh password (reset device,
// dll) bisa minta lewat endpoint terpisah / set ulang via Update.
type SubscriptionResponse struct {
	ID               uint   `json:"id"`
	CustomerID       uint   `json:"customer_id"`
	DeviceID         uint   `json:"device_id"`
	PPPProfileID     *uint  `json:"ppp_profile_id,omitempty"`
	HotspotProfileID *uint  `json:"hotspot_profile_id,omitempty"`
	ServiceType      string `json:"service_type"`
	MikrotikUsername   string     `json:"mikrotik_username"`
	Status             string     `json:"status"`
	BillingDay         *int       `json:"billing_day,omitempty"`
	NextInvoiceDate    *time.Time `json:"next_invoice_date,omitempty"`
	SyncStatus         string     `json:"sync_status"`
	SyncNotes          string     `json:"sync_notes,omitempty"`
	ActivatedAt        *time.Time `json:"activated_at,omitempty"`
	TerminatedAt       *time.Time `json:"terminated_at,omitempty"`
	Notes              string     `json:"notes"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// SubscriptionCreateRequest — body POST /subscriptions.
type SubscriptionCreateRequest struct {
	CustomerID       uint   `json:"customer_id"        binding:"required,gt=0"`
	DeviceID         uint   `json:"device_id"          binding:"required,gt=0"`
	PPPProfileID     *uint  `json:"ppp_profile_id"     binding:"omitempty,gt=0"`
	HotspotProfileID *uint  `json:"hotspot_profile_id" binding:"omitempty,gt=0"`
	ServiceType      string `json:"service_type"       binding:"required,oneof=pppoe hotspot"`
	MikrotikUsername string `json:"mikrotik_username"  binding:"required,min=1,max=100"`
	MikrotikPassword string `json:"mikrotik_password"  binding:"required,min=1,max=200"`
	BillingDay       *int   `json:"billing_day"        binding:"omitempty,gte=1,lte=28"`
	Notes            string `json:"notes"              binding:"max=2000"`
}

// SubscriptionUpdateRequest — body PUT. Field opsional. CustomerID,
// DeviceID, ServiceType, MikrotikUsername TIDAK boleh diubah lewat
// endpoint ini (composite natural key — kalau perlu pindah customer atau
// rename, hapus subscription dan buat baru).
type SubscriptionUpdateRequest struct {
	PPPProfileID     *uint   `json:"ppp_profile_id"     binding:"omitempty,gt=0"`
	HotspotProfileID *uint   `json:"hotspot_profile_id" binding:"omitempty,gt=0"`
	MikrotikPassword *string `json:"mikrotik_password"  binding:"omitempty,min=1,max=200"`
	Notes            *string `json:"notes"              binding:"omitempty,max=2000"`
}

// SubscriptionStatusPatchRequest — body PATCH /:id/status.
type SubscriptionStatusPatchRequest struct {
	Status string `json:"status" binding:"required,oneof=pending_install active isolir suspended terminated"`
}

// SubscriptionWriteResponse — wrapper untuk POST/PUT/PATCH/DELETE yang
// menyertakan optional warning ketika sync ke MikroTik gagal sementara
// DB sudah tersimpan. Operator bisa retry via reconcile.
type SubscriptionWriteResponse struct {
	Subscription SubscriptionResponse `json:"subscription"`
	Warning      string               `json:"warning,omitempty"`
}

// FromModelSubscription konversi model → response DTO. Password sengaja
// tidak di-copy ke output.
func FromModelSubscription(s model.Subscription) SubscriptionResponse {
	return SubscriptionResponse{
		ID:               s.ID,
		CustomerID:       s.CustomerID,
		DeviceID:         s.DeviceID,
		PPPProfileID:     s.PPPProfileID,
		HotspotProfileID: s.HotspotProfileID,
		ServiceType:      s.ServiceType,
		MikrotikUsername:   s.MikrotikUsername,
		Status:             s.Status,
		BillingDay:         s.BillingDay,
		NextInvoiceDate:    s.NextInvoiceDate,
		SyncStatus:         s.SyncStatus,
		SyncNotes:          s.SyncNotes,
		ActivatedAt:        s.ActivatedAt,
		TerminatedAt:       s.TerminatedAt,
		Notes:              s.Notes,
		CreatedAt:          s.CreatedAt,
		UpdatedAt:          s.UpdatedAt,
	}
}
