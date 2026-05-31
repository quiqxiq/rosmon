package store

import (
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Open membuka koneksi PostgreSQL via GORM. Caller bertanggung jawab Close.
func Open(dsn string) (*gorm.DB, error) {
	return gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
}

// isFKViolation returns true when err is a PostgreSQL foreign-key constraint
// violation (SQLSTATE 23503).
func isFKViolation(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(err.Error(), "23503") ||
		strings.Contains(err.Error(), "foreign key")
}

// IsUniqueViolation returns true when err is any unique-constraint violation
// (Postgres SQLSTATE 23505 / "duplicate key", atau SQLite "UNIQUE constraint").
// Exported untuk caller di luar package store (mis. settle-by-code idempotency).
func IsUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "23505") ||
		strings.Contains(msg, "duplicate key") ||
		strings.Contains(msg, "UNIQUE constraint")
}
