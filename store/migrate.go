package store

import (
	"github.com/quiqxiq/roslib-mikhmon/store/model"
	"gorm.io/gorm"
)

// Migrate menjalankan AutoMigrate untuk semua tabel.
func Migrate(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&model.User{},
		&model.RefreshToken{},
		&model.MikrotikDevice{},
		&model.Transaction{},
		&model.HotspotProfileConfig{},
		&model.Customer{},
		&model.BandwidthProfile{},
		&model.Subscription{},
	); err != nil {
		return err
	}
	return nil
}
