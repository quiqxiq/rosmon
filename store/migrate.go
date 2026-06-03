package store

import (
	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
)

// Migrate menjalankan AutoMigrate untuk semua tabel dan seed data default.
func Migrate(db *gorm.DB) error {
	// Buang legacy non-partial unique index pada users.email (dibuat oleh
	// skema lama `uniqueIndex`). Diganti partial index `uq_users_email`
	// (WHERE email <> '') via tag model. Idempoten & aman bila belum ada.
	db.Exec("DROP INDEX IF EXISTS idx_users_email")

	if err := db.AutoMigrate(
		&model.User{},
		&model.RefreshToken{},
		&model.MikrotikDevice{},
		&model.Transaction{},
		&model.SystemSetting{},
		&model.SequenceCounter{},
		&model.Customer{},
		&model.PPPProfile{},
		&model.HotspotProfile{},
		&model.Subscription{},
		&model.Invoice{},
		&model.InvoiceItem{},
		&model.Payment{},
		&model.AuditLog{},
		&model.MessageTemplate{},
		&model.NotificationLog{},
		&model.CustomerRegistration{},
		&model.Ticket{},
		&model.QuickPrintPackage{},
	); err != nil {
		return err
	}
	if err := seedSystemSettings(db); err != nil {
		return err
	}
	if err := seedMessageTemplates(db); err != nil {
		return err
	}
	return backfillInvoicePaymentCodes(db)
}

// backfillInvoicePaymentCodes assigns a unique PaymentCode to existing unpaid
// invoices (issued/overdue) that don't have one yet — so the settle-by-code /
// QR feature works for invoices created before this column existed. Idempotent.
func backfillInvoicePaymentCodes(db *gorm.DB) error {
	var invoices []model.Invoice
	if err := db.Where("(payment_code = '' OR payment_code IS NULL) AND status IN ?",
		[]string{"issued", "overdue"}).Find(&invoices).Error; err != nil {
		return err
	}
	for i := range invoices {
		code := NewPaymentCode()
		if err := db.Model(&model.Invoice{}).
			Where("id = ?", invoices[i].ID).
			Update("payment_code", code).Error; err != nil {
			return err
		}
	}
	return nil
}

// seedSystemSettings inserts default settings if they don't exist yet.
func seedSystemSettings(db *gorm.DB) error {
	defaults := []model.SystemSetting{
		{Key: "billing.default_billing_day", Value: "1", ValueType: "int", GroupName: "billing", Description: "Tanggal tagih default (1-28)"},
		{Key: "billing.invoice_due_days", Value: "7", ValueType: "int", GroupName: "billing", Description: "Jatuh tempo tagihan dalam hari"},
		{Key: "billing.isolir_after_days", Value: "3", ValueType: "int", GroupName: "billing", Description: "Hari setelah jatuh tempo untuk isolir"},
		{Key: "billing.hard_suspend_after_days", Value: "14", ValueType: "int", GroupName: "billing", Description: "Hari setelah jatuh tempo untuk suspend keras"},
		{Key: "billing.isolir_profile_name", Value: "isolir", ValueType: "string", GroupName: "billing", Description: "Nama profile MikroTik untuk pelanggan yang terisolir"},
		{Key: "notification.wa_enabled", Value: "false", ValueType: "bool", GroupName: "notification", Description: "Aktifkan notifikasi WhatsApp (whatsmeow embedded; login via QR di /whatsapp/qr)"},
		{Key: "notification.admin_phone", Value: "", ValueType: "string", GroupName: "notification", Description: "Nomor WA admin untuk notifikasi internal (registrasi baru, dll)"},
		{Key: "general.company_name", Value: "", ValueType: "string", GroupName: "general", Description: "Nama perusahaan ISP"},
		{Key: "general.hotspot_login_url", Value: "", ValueType: "string", GroupName: "general", Description: "URL login hotspot untuk dicetak di voucher (contoh: wifi.example.com)"},
		// Payment gateway — Xendit.
		// Semua konfigurasi Xendit disimpan di DB agar bisa diubah dari UI Settings
		// tanpa perlu restart server. secret_key di-mask di GET response (tidak pernah
		// dikembalikan ke client dalam bentuk plaintext).
		{Key: "payment.xendit_enabled", Value: "false", ValueType: "bool", GroupName: "payment_gateway", Description: "Aktifkan payment gateway Xendit"},
		{Key: "payment.xendit_secret_key", Value: "", ValueType: "secret", GroupName: "payment_gateway", Description: "Xendit API Secret Key (xnd_production_... / xnd_development_...)"},
		{Key: "payment.xendit_webhook_token", Value: "", ValueType: "secret", GroupName: "payment_gateway", Description: "Xendit X-CALLBACK-TOKEN untuk validasi webhook"},
		{Key: "payment.xendit_invoice_duration", Value: "86400", ValueType: "int", GroupName: "payment_gateway", Description: "Durasi link pembayaran Xendit dalam detik (default: 86400 = 24 jam)"},
		{Key: "payment.app_url", Value: "", ValueType: "string", GroupName: "payment_gateway", Description: "URL publik aplikasi untuk redirect setelah bayar (contoh: https://isp.example.com)"},
		// Backup settings
		{Key: "backup.enabled", Value: "false", ValueType: "bool", GroupName: "backup", Description: "Aktifkan backup otomatis harian"},
		{Key: "backup.path", Value: "./backups", ValueType: "string", GroupName: "backup", Description: "Direktori output backup"},
		{Key: "backup.retention_days", Value: "7", ValueType: "int", GroupName: "backup", Description: "Jumlah hari backup disimpan"},
		// Telegram notification (opsional, paralel dengan WhatsApp)
		{Key: "notification.telegram_enabled", Value: "false", ValueType: "bool", GroupName: "notification", Description: "Aktifkan notifikasi via Telegram Bot (untuk admin)"},
		{Key: "notification.telegram_bot_token", Value: "", ValueType: "secret", GroupName: "notification", Description: "Telegram Bot Token dari @BotFather"},
		{Key: "notification.telegram_chat_id", Value: "", ValueType: "string", GroupName: "notification", Description: "Telegram Chat ID target admin (group/channel/user)"},
	}
	for _, s := range defaults {
		s := s
		db.Where(model.SystemSetting{Key: s.Key}).FirstOrCreate(&s)
	}
	return nil
}

