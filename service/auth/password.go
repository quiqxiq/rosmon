package auth

import (
	"errors"

	"golang.org/x/crypto/bcrypt"
)

// Hasher membungkus bcrypt dengan cost configurable. Default cost 12.
// Test dapat pakai cost 4 untuk speed (bcrypt eksponensial terhadap cost).
type Hasher struct {
	Cost int
}

// NewHasher buat Hasher; cost yang invalid (<4 atau >31) di-clamp ke 12.
func NewHasher(cost int) *Hasher {
	if cost < bcrypt.MinCost || cost > bcrypt.MaxCost {
		cost = bcrypt.DefaultCost
	}
	return &Hasher{Cost: cost}
}

// Hash mengubah plaintext password menjadi bcrypt hash. Plaintext minimum
// 8 char (ErrWeakPassword) — caller wajib validate dulu.
func (h *Hasher) Hash(plaintext string) (string, error) {
	if len(plaintext) < 8 {
		return "", ErrWeakPassword
	}
	b, err := bcrypt.GenerateFromPassword([]byte(plaintext), h.Cost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// Verify bandingkan plaintext dengan hash. Return nil kalau match.
// ErrInvalidCredentials kalau mismatch (bcrypt-level invalid hash juga
// di-map ke ErrInvalidCredentials supaya caller tidak bisa membedakan
// "user tidak ada" vs "password salah").
func (h *Hasher) Verify(hash, plaintext string) error {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(plaintext))
	if err == nil {
		return nil
	}
	if errors.Is(err, bcrypt.ErrMismatchedHashAndPassword) {
		return ErrInvalidCredentials
	}
	return err
}
