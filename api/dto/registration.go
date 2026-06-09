package dto

import (
	"time"

	"github.com/quiqxiq/rosmon/store/model"
)

// RegistrationCreateRequest — body POST /public/registrations (publik, tanpa auth).
// ServiceType + PPPProfileID/HotspotProfileID = pilihan paket dari form publik (hint).
type RegistrationCreateRequest struct {
	FullName         string `json:"full_name"          binding:"required,min=2,max=200"`
	Phone            string `json:"phone"              binding:"required,min=3,max=20"`
	Address          string `json:"address"            binding:"required,min=3,max=2000"`
	Area             string `json:"area"               binding:"max=100"`
	Notes            string `json:"notes"              binding:"max=2000"`
	ServiceType      string `json:"service_type"       binding:"omitempty,oneof=pppoe hotspot"`
	PPPProfileID     *uint  `json:"ppp_profile_id"     binding:"omitempty,gt=0"`
	HotspotProfileID *uint  `json:"hotspot_profile_id" binding:"omitempty,gt=0"`
	DeviceID         *uint  `json:"device_id"          binding:"omitempty,gt=0"`
}

// RegistrationResponse — representasi registrasi di API response.
type RegistrationResponse struct {
	ID               uint       `json:"id"`
	FullName         string     `json:"full_name"`
	Phone            string     `json:"phone"`
	Address          string     `json:"address"`
	Area             string     `json:"area"`
	Notes            string     `json:"notes"`
	ServiceType      string     `json:"service_type,omitempty"`
	PPPProfileID     *uint      `json:"ppp_profile_id,omitempty"`
	HotspotProfileID *uint      `json:"hotspot_profile_id,omitempty"`
	DeviceID         *uint      `json:"device_id,omitempty"`
	Status           string     `json:"status"`
	RejectionReason  string     `json:"rejection_reason,omitempty"`
	ReviewedBy       *uint      `json:"reviewed_by,omitempty"`
	ReviewedAt       *time.Time `json:"reviewed_at,omitempty"`
	AssignedTo       *uint      `json:"assigned_to,omitempty"`
	ScheduledAt      *time.Time `json:"scheduled_at,omitempty"`
	InstalledAt      *time.Time `json:"installed_at,omitempty"`
	CustomerID       *uint      `json:"customer_id,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// RegistrationApproveRequest — body POST /:id/approve. Jadwal opsional.
type RegistrationApproveRequest struct {
	ScheduledAt *time.Time `json:"scheduled_at"`
}

// RegistrationRejectRequest — body POST /:id/reject.
type RegistrationRejectRequest struct {
	Reason string `json:"reason" binding:"required,min=1,max=2000"`
}

// RegistrationAssignRequest — body PUT /:id/assign.
type RegistrationAssignRequest struct {
	AssignedTo  uint       `json:"assigned_to"  binding:"required,gt=0"`
	ScheduledAt *time.Time `json:"scheduled_at"`
}

// RegistrationCompleteInstallRequest — body POST /:id/complete-install.
// Operator mengisi detail provisioning final di sini.
type RegistrationCompleteInstallRequest struct {
	DeviceID         uint   `json:"device_id"          binding:"required,gt=0"`
	ServiceType      string `json:"service_type"       binding:"required,oneof=pppoe hotspot"`
	PPPProfileID     *uint  `json:"ppp_profile_id"     binding:"omitempty,gt=0"`
	HotspotProfileID *uint  `json:"hotspot_profile_id" binding:"omitempty,gt=0"`
	MikrotikUsername string `json:"mikrotik_username"  binding:"required,min=1,max=100"`
	MikrotikPassword string `json:"mikrotik_password"  binding:"required,min=1,max=200"`
	BillingDay       *int   `json:"billing_day"        binding:"omitempty,gte=1,lte=28"`
}

// FromModelRegistration konversi model → response DTO.
func FromModelRegistration(r model.CustomerRegistration) RegistrationResponse {
	return RegistrationResponse{
		ID:               r.ID,
		FullName:         r.FullName,
		Phone:            r.Phone,
		Address:          r.Address,
		Area:             r.Area,
		Notes:            r.Notes,
		ServiceType:      r.ServiceType,
		PPPProfileID:     r.PPPProfileID,
		HotspotProfileID: r.HotspotProfileID,
		DeviceID:         r.DeviceID,
		Status:           r.Status,
		RejectionReason:  r.RejectionReason,
		ReviewedBy:       r.ReviewedBy,
		ReviewedAt:       r.ReviewedAt,
		AssignedTo:       r.AssignedTo,
		ScheduledAt:      r.ScheduledAt,
		InstalledAt:      r.InstalledAt,
		CustomerID:       r.CustomerID,
		CreatedAt:        r.CreatedAt,
		UpdatedAt:        r.UpdatedAt,
	}
}
