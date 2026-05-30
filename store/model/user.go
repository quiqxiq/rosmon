package model

import (
	"time"

	"gorm.io/gorm"
)

// User adalah tabel autentikasi operator. Implementasi login belum ada.
type User struct {
	ID       uint   `gorm:"primaryKey"`
	Username string `gorm:"uniqueIndex;not null;size:64"`
	// Email opsional & unik HANYA bila diisi. Tanpa partial index, dua user
	// tanpa email (string kosong) akan bentrok di unique index Postgres.
	// Partial index `WHERE email <> ''` membolehkan banyak baris email kosong.
	Email     string `gorm:"uniqueIndex:uq_users_email,where:email <> '';size:128"`
	Password  string `gorm:"not null"`
	Role      string `gorm:"default:'operator';size:32"`
	Active    bool   `gorm:"default:true"`
	CreatedAt time.Time
	UpdatedAt time.Time
	DeletedAt gorm.DeletedAt `gorm:"index"`
}
