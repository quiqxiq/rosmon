package config

import "os"

// NotificationConfig memuat konfigurasi notifikasi/WhatsApp dari env.
// Toggle aktif/nonaktif tetap di system_settings (notification.wa_enabled) —
// di sini hanya hal yang sifatnya deployment-level.
type NotificationConfig struct {
	// WACountryCode dipakai untuk normalisasi nomor lokal (mis. "08..." →
	// "628..."). Default "62" (Indonesia).
	WACountryCode string
}

// LoadNotificationFromEnv membaca config notifikasi. Env: WA_COUNTRY_CODE.
func LoadNotificationFromEnv() NotificationConfig {
	cc := os.Getenv("WA_COUNTRY_CODE")
	if cc == "" {
		cc = "62"
	}
	return NotificationConfig{WACountryCode: cc}
}
