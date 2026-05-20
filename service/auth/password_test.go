package auth

import (
	"errors"
	"testing"
)

// Cost 4 = bcrypt MinCost, supaya unit test cepat (~1ms vs ~250ms di cost 12).
const testCost = 4

func TestHasher_HashAndVerify_match(t *testing.T) {
	t.Parallel()
	h := NewHasher(testCost)
	hash, err := h.Hash("password123")
	if err != nil {
		t.Fatalf("hash err = %v", err)
	}
	if hash == "" {
		t.Fatal("hash kosong")
	}
	if err := h.Verify(hash, "password123"); err != nil {
		t.Errorf("verify err = %v", err)
	}
}

func TestHasher_Verify_mismatch(t *testing.T) {
	t.Parallel()
	h := NewHasher(testCost)
	hash, _ := h.Hash("password123")
	err := h.Verify(hash, "wrongpassword")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("err = %v, want ErrInvalidCredentials", err)
	}
}

func TestHasher_rejectsWeakPassword(t *testing.T) {
	t.Parallel()
	h := NewHasher(testCost)
	for _, weak := range []string{"", "a", "1234567"} {
		_, err := h.Hash(weak)
		if !errors.Is(err, ErrWeakPassword) {
			t.Errorf("input %q: err = %v, want ErrWeakPassword", weak, err)
		}
	}
}

func TestNewHasher_clampsInvalidCost(t *testing.T) {
	t.Parallel()
	for _, cost := range []int{0, 3, 32, 100, -1} {
		h := NewHasher(cost)
		if h.Cost < 4 || h.Cost > 31 {
			t.Errorf("cost %d → got %d, want clamped to valid range", cost, h.Cost)
		}
	}
}
