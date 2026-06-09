package store

import (
	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
)

// seedMessageTemplates menanam template notifikasi default kalau slug-nya
// belum ada. Idempotent (FirstOrCreate by slug) — tidak menimpa editan admin.
// Body memakai sintaks text/template: variabel {{.FieldName}}.
func seedMessageTemplates(db *gorm.DB) error {
	defaults := []model.MessageTemplate{
		{
			Slug: "registration_received", Name: "Registrasi Diterima (ke Admin)",
			Variables: `["customer_name","phone","address","area"]`,
			Body:      "🔔 Pendaftaran baru:\nNama: {{.customer_name}}\nNo. HP: {{.phone}}\nAlamat: {{.address}}\nArea: {{.area}}\n\nMohon segera ditinjau di dashboard.",
		},
		{
			Slug: "registration_approved", Name: "Registrasi Disetujui",
			Variables: `["customer_name","company_name","schedule"]`,
			Body:      "Halo {{.customer_name}}, pendaftaran Anda di {{.company_name}} *disetujui*. ✅\nJadwal pemasangan: {{.schedule}}.\nTeknisi kami akan menghubungi Anda. Terima kasih.",
		},
		{
			Slug: "registration_rejected", Name: "Registrasi Ditolak",
			Variables: `["customer_name","company_name","reason"]`,
			Body:      "Halo {{.customer_name}}, mohon maaf pendaftaran Anda di {{.company_name}} belum dapat kami proses.\nAlasan: {{.reason}}\nSilakan hubungi kami untuk informasi lebih lanjut.",
		},
		{
			Slug: "installation_complete", Name: "Pemasangan Selesai",
			Variables: `["customer_name","company_name","address","portal_url","portal_username","portal_password"]`,
			Body:      "Halo {{.customer_name}}, layanan internet Anda di {{.address}} sudah aktif! 🎉\n\nAkses portal pelanggan Anda:\n{{.portal_url}}\nUsername: {{.portal_username}}\nPassword: {{.portal_password}}\n\nSimpan password Anda & jangan bagikan ke siapapun.\nSelamat menikmati layanan {{.company_name}}.",
		},
		{
			Slug: "invoice_issued", Name: "Tagihan Terbit",
			Variables: `["customer_name","company_name","invoice_number","amount","period","due_date"]`,
			Body:      "Halo {{.customer_name}}, tagihan {{.company_name}} periode {{.period}} telah terbit.\nNo. Tagihan: {{.invoice_number}}\nJumlah: Rp {{.amount}}\nJatuh tempo: {{.due_date}}\nMohon lakukan pembayaran sebelum jatuh tempo. Terima kasih.",
		},
		{
			Slug: "invoice_reminder", Name: "Pengingat Tagihan",
			Variables: `["customer_name","invoice_number","amount","due_date"]`,
			Body:      "Halo {{.customer_name}}, pengingat: tagihan {{.invoice_number}} sebesar Rp {{.amount}} akan jatuh tempo pada {{.due_date}}. Mohon segera lakukan pembayaran. 🙏",
		},
		{
			Slug: "invoice_overdue", Name: "Tagihan Lewat Jatuh Tempo",
			Variables: `["customer_name","invoice_number","amount","due_date"]`,
			Body:      "Halo {{.customer_name}}, tagihan {{.invoice_number}} sebesar Rp {{.amount}} telah *melewati jatuh tempo* ({{.due_date}}). Mohon segera lakukan pembayaran untuk menghindari pemutusan layanan.",
		},
		{
			Slug: "service_isolir", Name: "Layanan Diisolir",
			Variables: `["customer_name","company_name"]`,
			Body:      "Halo {{.customer_name}}, layanan internet Anda *dibatasi* karena tagihan belum dibayar. Segera lakukan pembayaran agar layanan kembali normal. — {{.company_name}}",
		},
		{
			Slug: "service_suspended", Name: "Layanan Diputus",
			Variables: `["customer_name","company_name"]`,
			Body:      "Halo {{.customer_name}}, layanan internet Anda *diputus sementara* karena tunggakan. Mohon segera lakukan pembayaran untuk pengaktifan kembali. — {{.company_name}}",
		},
		{
			Slug: "service_restored", Name: "Layanan Dipulihkan",
			Variables: `["customer_name","company_name"]`,
			Body:      "Halo {{.customer_name}}, layanan internet Anda telah *aktif kembali*. ✅ Terima kasih atas pembayarannya. — {{.company_name}}",
		},
		{
			Slug: "payment_confirmed", Name: "Pembayaran Dikonfirmasi",
			Variables: `["customer_name","invoice_number","amount"]`,
			Body:      "Halo {{.customer_name}}, pembayaran untuk tagihan {{.invoice_number}} sebesar Rp {{.amount}} telah *dikonfirmasi*. ✅ Terima kasih.",
		},
		{
			Slug: "payment_rejected", Name: "Pembayaran Ditolak",
			Variables: `["customer_name","invoice_number","reason"]`,
			Body:      "Halo {{.customer_name}}, pembayaran untuk tagihan {{.invoice_number}} *belum dapat kami verifikasi*.\nAlasan: {{.reason}}\nMohon periksa kembali bukti pembayaran Anda.",
		},
		{
			Slug: "package_changed", Name: "Paket Diubah",
			Variables: `["customer_name","package_name","company_name"]`,
			Body:      "Halo {{.customer_name}}, paket layanan Anda telah diubah menjadi *{{.package_name}}*. Perubahan kecepatan akan berlaku segera. — {{.company_name}}",
		},
		{
			Slug: "outbox_escalation", Name: "Outbox Sync Gagal (Admin)",
			Variables: `["subscription_id","service_type","mikrotik_username","error","retry_count"]`,
			Body:      "⚠️ *Outbox Escalation*\nSubscription #{{.subscription_id}} ({{.service_type}}/{{.mikrotik_username}}) gagal disinkronkan ke router sebanyak {{.retry_count}} kali.\n\nError terakhir: {{.error}}\n\nSilakan cek koneksi router dan rekonsiliasi manual via dashboard.",
		},
	}
	for _, t := range defaults {
		t := t
		if err := db.Where(model.MessageTemplate{Slug: t.Slug}).FirstOrCreate(&t).Error; err != nil {
			return err
		}
	}
	return nil
}
