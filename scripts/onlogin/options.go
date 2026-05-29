package onlogin

import "github.com/quiqxiq/rosmon/domain"

// Options mendeskripsikan parameter generate body script on-login.
//
// Cross-ref: analisis §3.1.
type Options struct {
	// Mode menentukan kelakuan script (analisis §5).
	Mode domain.ExpiredMode

	// Validity adalah durasi paket dalam format RouterOS, mis. "30d", "1h".
	// Diabaikan saat Mode = ModeNone.
	Validity string

	// Price (nilai numerik raw) — di-embed ke metadata `:put`.
	Price int

	// SellPrice (sprice) — harga jual ke end user.
	SellPrice int

	// LockMAC menambah blok lock user ke MAC saat login pertama.
	LockMAC bool

	// WebhookURL adalah URL absolut yang dipanggil oleh script saat user
	// login (fire-and-forget POST). Kalau kosong, blok webhook tidak
	// di-emit. Format: "http://<host>:<port>/api/v1/hook/hotspot/login/<device_id>".
	//
	// MVP: pengganti writeRecordBlock lama yang menulis transaksi ke
	// /system/script. Sekarang transaksi di-record langsung ke PostgreSQL
	// oleh Go service via webhook handler.
	WebhookURL string

	// ProfileName di-embed ke webhook payload sebagai field `profile`.
	// Webhook handler memakai ini untuk lookup profile_config tanpa perlu
	// query RouterOS lagi (lebih reliable, tidak tergantung router online
	// saat webhook fire). Kalau kosong, field profile tidak di-set di
	// payload.
	ProfileName string
}

// metadataLockToken mengembalikan kata "Enable" / "Disable" yang diharapkan
// PHP saat parse metadata `:put`.
func (o Options) metadataLockToken() string {
	if o.LockMAC {
		return "Enable"
	}
	return "Disable"
}
