package config

import (
	"errors"
	"testing"
	"time"
)

func TestLoadAuthFromEnv_requiresSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "")
	_, err := LoadAuthFromEnv()
	if !errors.Is(err, ErrJWTSecretRequired) {
		t.Fatalf("err = %v, want ErrJWTSecretRequired", err)
	}
}

func TestLoadAuthFromEnv_rejectsShortSecret(t *testing.T) {
	t.Setenv("JWT_SECRET", "short")
	_, err := LoadAuthFromEnv()
	if !errors.Is(err, ErrJWTSecretRequired) {
		t.Fatalf("err = %v, want ErrJWTSecretRequired", err)
	}
}

func TestLoadAuthFromEnv_defaults(t *testing.T) {
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef") // 32 chars
	t.Setenv("JWT_ACCESS_TTL", "")
	t.Setenv("JWT_REFRESH_TTL", "")
	t.Setenv("BCRYPT_COST", "")
	cfg, err := LoadAuthFromEnv()
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if cfg.AccessTTL != 15*time.Minute {
		t.Errorf("AccessTTL = %v, want 15m", cfg.AccessTTL)
	}
	if cfg.RefreshTTL != 7*24*time.Hour {
		t.Errorf("RefreshTTL = %v, want 168h", cfg.RefreshTTL)
	}
	if cfg.BcryptCost != 12 {
		t.Errorf("BcryptCost = %d, want 12", cfg.BcryptCost)
	}
}

func TestLoadAuthFromEnv_overrides(t *testing.T) {
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")
	t.Setenv("JWT_ACCESS_TTL", "5m")
	t.Setenv("JWT_REFRESH_TTL", "24h")
	t.Setenv("BCRYPT_COST", "10")
	t.Setenv("ADMIN_USERNAME", "admin")
	t.Setenv("ADMIN_PASSWORD", "secret-pass")
	cfg, err := LoadAuthFromEnv()
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if cfg.AccessTTL != 5*time.Minute {
		t.Errorf("AccessTTL = %v", cfg.AccessTTL)
	}
	if cfg.RefreshTTL != 24*time.Hour {
		t.Errorf("RefreshTTL = %v", cfg.RefreshTTL)
	}
	if cfg.BcryptCost != 10 {
		t.Errorf("BcryptCost = %d", cfg.BcryptCost)
	}
	if cfg.AdminUsername != "admin" || cfg.AdminPassword != "secret-pass" {
		t.Errorf("admin creds: %q / %q", cfg.AdminUsername, cfg.AdminPassword)
	}
}
