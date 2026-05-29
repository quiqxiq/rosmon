package model

import "time"

// SystemSetting adalah key-value store untuk konfigurasi global sistem.
// Diakses via SettingStore.Get/Set. Seed default dilakukan saat Migrate.
type SystemSetting struct {
	ID          uint   `gorm:"primaryKey"`
	Key         string `gorm:"size:100;uniqueIndex;not null"`
	Value       string `gorm:"type:text;not null;default:''"`
	ValueType   string `gorm:"size:20;not null;default:string"` // 'string' | 'int' | 'bool'
	Description string `gorm:"type:text"`
	GroupName   string `gorm:"size:50"`
	CreatedAt   time.Time
	UpdatedAt   time.Time
}
