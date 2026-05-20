package auth

import (
	"errors"
	"testing"
	"time"
)

const testSecret = "0123456789abcdef0123456789abcdef" // 32 bytes

func TestSigner_SignAndVerifyAccess(t *testing.T) {
	t.Parallel()
	s := NewSigner(testSecret, 15*time.Minute, time.Hour)
	tok, err := s.SignAccess(42, "alice", RoleOperator)
	if err != nil {
		t.Fatalf("sign err = %v", err)
	}
	claims, err := s.VerifyAccess(tok)
	if err != nil {
		t.Fatalf("verify err = %v", err)
	}
	if claims.UserID != 42 || claims.Username != "alice" || claims.Role != RoleOperator {
		t.Errorf("claims mismatch: %+v", claims)
	}
	if claims.TokenTyp != TokenTypeAccess {
		t.Errorf("typ = %q, want access", claims.TokenTyp)
	}
}

func TestSigner_SignAndVerifyRefresh(t *testing.T) {
	t.Parallel()
	s := NewSigner(testSecret, time.Minute, time.Hour)
	jti := NewJTI()
	tok, exp, err := s.SignRefresh(7, "bob", RoleAdmin, jti)
	if err != nil {
		t.Fatalf("sign err = %v", err)
	}
	if time.Until(exp) < 50*time.Minute {
		t.Errorf("expiry too soon: %v", exp)
	}
	claims, err := s.VerifyRefresh(tok)
	if err != nil {
		t.Fatalf("verify err = %v", err)
	}
	if claims.ID != jti {
		t.Errorf("jti = %q, want %q", claims.ID, jti)
	}
	if claims.TokenTyp != TokenTypeRefresh {
		t.Errorf("typ = %q, want refresh", claims.TokenTyp)
	}
}

func TestSigner_VerifyAccess_rejectsRefresh(t *testing.T) {
	t.Parallel()
	s := NewSigner(testSecret, time.Minute, time.Hour)
	tok, _, _ := s.SignRefresh(1, "u", RoleViewer, NewJTI())
	_, err := s.VerifyAccess(tok)
	if !errors.Is(err, ErrTokenWrongType) {
		t.Errorf("err = %v, want ErrTokenWrongType", err)
	}
}

func TestSigner_VerifyRefresh_rejectsAccess(t *testing.T) {
	t.Parallel()
	s := NewSigner(testSecret, time.Minute, time.Hour)
	tok, _ := s.SignAccess(1, "u", RoleViewer)
	_, err := s.VerifyRefresh(tok)
	if !errors.Is(err, ErrTokenWrongType) {
		t.Errorf("err = %v, want ErrTokenWrongType", err)
	}
}

func TestSigner_VerifyAccess_expired(t *testing.T) {
	t.Parallel()
	s := NewSigner(testSecret, time.Millisecond, time.Hour)
	// Inject past clock via Signer.now hack: build a Signer with custom now.
	s.now = func() time.Time { return time.Now().Add(-time.Hour) }
	tok, _ := s.SignAccess(1, "u", RoleViewer)
	// Reset clock untuk verify path (verify pakai jwt lib internal clock).
	s.now = time.Now
	_, err := s.VerifyAccess(tok)
	if !errors.Is(err, ErrTokenExpired) {
		t.Errorf("err = %v, want ErrTokenExpired", err)
	}
}

func TestSigner_VerifyAccess_wrongSecret(t *testing.T) {
	t.Parallel()
	signer := NewSigner(testSecret, time.Minute, time.Hour)
	tok, _ := signer.SignAccess(1, "u", RoleViewer)
	other := NewSigner("ffffffffffffffffffffffffffffffff", time.Minute, time.Hour)
	_, err := other.VerifyAccess(tok)
	if !errors.Is(err, ErrTokenInvalid) {
		t.Errorf("err = %v, want ErrTokenInvalid", err)
	}
}

func TestSigner_VerifyAccess_garbage(t *testing.T) {
	t.Parallel()
	s := NewSigner(testSecret, time.Minute, time.Hour)
	_, err := s.VerifyAccess("not.a.jwt")
	if !errors.Is(err, ErrTokenInvalid) {
		t.Errorf("err = %v, want ErrTokenInvalid", err)
	}
}
