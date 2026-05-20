package model

import "time"

// RefreshToken adalah catatan refresh JWT yang diberikan ke user. Dipakai
// untuk:
//   - Rotation: refresh menukar token lama → token baru. Token lama
//     ditandai `RevokedAt != nil`.
//   - Revocation: logout / admin revoke.
//
// Access token tidak disimpan — stateless verify cukup di middleware.
type RefreshToken struct {
	ID        uint   `gorm:"primaryKey"`
	JTI       string `gorm:"uniqueIndex;not null;size:64"`
	UserID    uint   `gorm:"index;not null"`
	ExpiresAt time.Time
	RevokedAt *time.Time
	CreatedAt time.Time
}
