package auth

import (
	"errors"
	"testing"
	"time"
)

func TestSigner_SignAndVerifyCustomerAccess(t *testing.T) {
	t.Parallel()
	s := NewSigner(testSecret, 15*time.Minute, time.Hour)
	tok, err := s.SignCustomerAccess(99, "081234567890")
	if err != nil {
		t.Fatalf("sign err = %v", err)
	}
	claims, err := s.VerifyCustomerAccess(tok)
	if err != nil {
		t.Fatalf("verify err = %v", err)
	}
	if claims.CustomerID != 99 || claims.Phone != "081234567890" {
		t.Errorf("claims mismatch: %+v", claims)
	}
	if claims.TokenTyp != TokenTypeCustomerAccess {
		t.Errorf("typ = %q, want customer_access", claims.TokenTyp)
	}
}

// Staff access token must be rejected by the customer verifier (separate scope).
func TestSigner_VerifyCustomerAccess_rejectsStaffToken(t *testing.T) {
	t.Parallel()
	s := NewSigner(testSecret, time.Minute, time.Hour)
	staffTok, _ := s.SignAccess(1, "admin", RoleAdmin)
	_, err := s.VerifyCustomerAccess(staffTok)
	if !errors.Is(err, ErrTokenWrongType) {
		t.Errorf("err = %v, want ErrTokenWrongType", err)
	}
}

// Customer token must be rejected by the staff verifier.
func TestSigner_VerifyAccess_rejectsCustomerToken(t *testing.T) {
	t.Parallel()
	s := NewSigner(testSecret, time.Minute, time.Hour)
	custTok, _ := s.SignCustomerAccess(5, "0811")
	_, err := s.VerifyAccess(custTok)
	if !errors.Is(err, ErrTokenWrongType) {
		t.Errorf("err = %v, want ErrTokenWrongType", err)
	}
}

func TestSigner_CustomerTTL_default_and_override(t *testing.T) {
	t.Parallel()
	s := NewSigner(testSecret, time.Minute, time.Hour)
	if s.CustomerTTL() != 24*time.Hour {
		t.Errorf("default customer ttl = %v, want 24h", s.CustomerTTL())
	}
	s.SetCustomerTTL(48 * time.Hour)
	if s.CustomerTTL() != 48*time.Hour {
		t.Errorf("override customer ttl = %v, want 48h", s.CustomerTTL())
	}
	s.SetCustomerTTL(0) // ignored
	if s.CustomerTTL() != 48*time.Hour {
		t.Errorf("ttl after zero-set = %v, want 48h", s.CustomerTTL())
	}
}
