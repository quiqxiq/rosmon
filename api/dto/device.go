package dto

import (
	"time"

	"github.com/quiqxiq/rosmon/store/model"
)

// DeviceResponse adalah response publik untuk mikrotik device.
// Password tidak di-expose.
type DeviceResponse struct {
	ID                  uint       `json:"id"`
	DisplayName         string     `json:"display_name"`
	Address             string     `json:"address"`
	Username            string     `json:"username"`
	UseTLS              bool       `json:"use_tls"`
	Status              string     `json:"status"`
	LastSeen            *time.Time `json:"last_seen,omitempty"`
	LastError           string     `json:"last_error,omitempty"`
	ExpiryCheckInterval string     `json:"expiry_check_interval"`
	TimeZone            string     `json:"time_zone,omitempty"`
	Active              bool       `json:"active"`
	CreatedAt           time.Time  `json:"created_at"`
}

// DeviceWriteResponse adalah response untuk create/update device.
// Field Warning di-set kalau record berhasil tersimpan namun koneksi
// devmgr gagal (mis. credential salah, host unreachable). Front-end
// bisa menampilkan warning ini tanpa kehilangan device record.
type DeviceWriteResponse struct {
	Device  DeviceResponse `json:"device"`
	Warning string         `json:"warning,omitempty"`
}

func FromModelDevice(d model.MikrotikDevice) DeviceResponse {
	return DeviceResponse{
		ID:                  d.ID,
		DisplayName:         d.DisplayName,
		Address:             d.Address,
		Username:            d.Username,
		UseTLS:              d.UseTLS,
		Status:              d.Status,
		LastSeen:            d.LastSeen,
		LastError:           d.LastError,
		ExpiryCheckInterval: d.ExpiryCheckInterval,
		TimeZone:            d.TimeZone,
		Active:              d.Active,
		CreatedAt:           d.CreatedAt,
	}
}

type DeviceCreateRequest struct {
	DisplayName         string `json:"display_name" binding:"required,min=1,max=128"`
	Address             string `json:"address"      binding:"required"`
	Username            string `json:"username"     binding:"required"`
	Password            string `json:"password"     binding:"required"`
	UseTLS              bool   `json:"use_tls"`
	ExpiryCheckInterval string `json:"expiry_check_interval"`
}

func (r DeviceCreateRequest) ToModel() model.MikrotikDevice {
	interval := r.ExpiryCheckInterval
	if interval == "" {
		interval = "2m"
	}
	return model.MikrotikDevice{
		DisplayName:         r.DisplayName,
		Address:             r.Address,
		Username:            r.Username,
		Password:            r.Password,
		UseTLS:              r.UseTLS,
		ExpiryCheckInterval: interval,
		Active:              true,
		Status:              "disconnected",
	}
}

type DeviceUpdateRequest struct {
	DisplayName         string `json:"display_name,omitempty"`
	Address             string `json:"address,omitempty"`
	Username            string `json:"username,omitempty"`
	Password            string `json:"password,omitempty"`
	UseTLS              *bool  `json:"use_tls,omitempty"`
	ExpiryCheckInterval string `json:"expiry_check_interval,omitempty"`
	Active              *bool  `json:"active,omitempty"`
}

func (r DeviceUpdateRequest) Apply(d *model.MikrotikDevice) {
	if r.DisplayName != "" {
		d.DisplayName = r.DisplayName
	}
	if r.Address != "" {
		d.Address = r.Address
	}
	if r.Username != "" {
		d.Username = r.Username
	}
	if r.Password != "" {
		d.Password = r.Password
	}
	if r.UseTLS != nil {
		d.UseTLS = *r.UseTLS
	}
	if r.ExpiryCheckInterval != "" {
		d.ExpiryCheckInterval = r.ExpiryCheckInterval
	}
	if r.Active != nil {
		d.Active = *r.Active
	}
}
