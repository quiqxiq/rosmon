package dto

import "github.com/quiqxiq/rosmon/store/model"

// PublicPackageResponse — item paket di GET /public/packages (publik, tanpa auth).
// Hanya memuat field non-sensitif yang aman ditampilkan ke calon pelanggan.
type PublicPackageResponse struct {
	ID          uint   `json:"id"`
	ServiceType string `json:"service_type"` // 'pppoe' | 'hotspot'
	Name        string `json:"name"`
	Price       int64  `json:"price"` // harga bulanan
	RateLimit   string `json:"rate_limit,omitempty"`
	Description string `json:"description,omitempty"`
	DeviceID    uint   `json:"device_id"`
}

// PublicPackageFromPPP memetakan PPPProfile → paket publik pppoe.
func PublicPackageFromPPP(p model.PPPProfile) PublicPackageResponse {
	return PublicPackageResponse{
		ID:          p.ID,
		ServiceType: "pppoe",
		Name:        p.Name,
		Price:       p.PriceMonthly,
		RateLimit:   p.RateLimit,
		Description: p.Description,
		DeviceID:    p.DeviceID,
	}
}

// PublicPackageFromHotspot memetakan HotspotProfile → paket publik hotspot.
func PublicPackageFromHotspot(p model.HotspotProfile) PublicPackageResponse {
	return PublicPackageResponse{
		ID:          p.ID,
		ServiceType: "hotspot",
		Name:        p.Name,
		Price:       p.PriceMonthly,
		RateLimit:   p.RateLimit,
		Description: p.Description,
		DeviceID:    p.DeviceID,
	}
}
