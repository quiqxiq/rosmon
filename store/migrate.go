package store

import (
	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
)

// Migrate menjalankan AutoMigrate untuk semua tabel dan seed data default.
func Migrate(db *gorm.DB) error {
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
	); err != nil {
		return err
	}
	return seedSystemSettings(db)
}

// seedSystemSettings inserts default settings if they don't exist yet.
func seedSystemSettings(db *gorm.DB) error {
	defaults := []model.SystemSetting{
		{Key: "billing.default_billing_day", Value: "1", ValueType: "int", GroupName: "billing", Description: "Tanggal tagih default (1-28)"},
		{Key: "billing.invoice_due_days", Value: "7", ValueType: "int", GroupName: "billing", Description: "Jatuh tempo tagihan dalam hari"},
		{Key: "billing.isolir_after_days", Value: "3", ValueType: "int", GroupName: "billing", Description: "Hari setelah jatuh tempo untuk isolir"},
		{Key: "billing.hard_suspend_after_days", Value: "14", ValueType: "int", GroupName: "billing", Description: "Hari setelah jatuh tempo untuk suspend keras"},
		{Key: "billing.isolir_profile_name", Value: "isolir", ValueType: "string", GroupName: "billing", Description: "Nama profile MikroTik untuk pelanggan yang terisolir"},
		{Key: "notification.wa_enabled", Value: "false", ValueType: "bool", GroupName: "notification", Description: "Aktifkan notifikasi WhatsApp"},
		{Key: "notification.wa_api_url", Value: "", ValueType: "string", GroupName: "notification", Description: "URL go-wa API"},
		{Key: "notification.wa_sender", Value: "", ValueType: "string", GroupName: "notification", Description: "Nomor pengirim WhatsApp"},
		{Key: "general.company_name", Value: "", ValueType: "string", GroupName: "general", Description: "Nama perusahaan ISP"},
	}
	for _, s := range defaults {
		s := s
		db.Where(model.SystemSetting{Key: s.Key}).FirstOrCreate(&s)
	}
	return nil
}
