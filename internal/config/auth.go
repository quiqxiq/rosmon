package config

import (
	"errors"
	"strconv"
	"strings"
	"time"
)

// AuthConfig mengontrol service/auth: JWT secret, TTL access/refresh,
// bcrypt cost, dan bootstrap admin via env.
type AuthConfig struct {
	JWTSecret     string        // wajib, minimal 32 char
	AccessTTL     time.Duration // default 15m
	RefreshTTL    time.Duration // default 168h (7d)
	BcryptCost    int           // default 12, range 4-31
	AdminUsername string        // optional — kalau set bareng AdminPassword, akan dibuat saat startup
	AdminPassword string
}

// ErrJWTSecretRequired dikembalikan kalau JWT_SECRET kosong / terlalu pendek.
var ErrJWTSecretRequired = errors.New("JWT_SECRET required (min 32 chars)")

// LoadAuthFromEnv membaca env JWT_*, BCRYPT_COST, ADMIN_USERNAME/PASSWORD.
// Fail-fast kalau JWT_SECRET kurang dari 32 char.
func LoadAuthFromEnv() (*AuthConfig, error) {
	secret := strings.TrimSpace(getenv("JWT_SECRET", ""))
	if len(secret) < 32 {
		return nil, ErrJWTSecretRequired
	}
	cost := 12
	if v := strings.TrimSpace(getenv("BCRYPT_COST", "")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 4 && n <= 31 {
			cost = n
		}
	}
	return &AuthConfig{
		JWTSecret:     secret,
		AccessTTL:     getenvDur("JWT_ACCESS_TTL", 15*time.Minute),
		RefreshTTL:    getenvDur("JWT_REFRESH_TTL", 7*24*time.Hour),
		BcryptCost:    cost,
		AdminUsername: getenv("ADMIN_USERNAME", ""),
		AdminPassword: getenv("ADMIN_PASSWORD", ""),
	}, nil
}
