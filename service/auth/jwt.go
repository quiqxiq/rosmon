package auth

import (
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Token type discriminator di field "typ".
const (
	TokenTypeAccess         = "access"
	TokenTypeRefresh        = "refresh"
	TokenTypeCustomerAccess = "customer_access"
)

// Claims adalah body JWT rosmon (staff).
type Claims struct {
	UserID   uint   `json:"uid"`
	Username string `json:"usr"`
	Role     string `json:"rol"`
	TokenTyp string `json:"typ"` // "access" | "refresh"
	jwt.RegisteredClaims
}

// CustomerClaims adalah body JWT untuk customer portal — scope TERPISAH dari
// staff. typ "customer_access" membuat token staff & customer saling tolak
// (VerifyAccess vs VerifyCustomerAccess).
type CustomerClaims struct {
	CustomerID uint   `json:"cid"`
	Phone      string `json:"phn"`
	TokenTyp   string `json:"typ"` // "customer_access"
	jwt.RegisteredClaims
}

// Signer membuat & verify JWT HS256. accessTTL & refreshTTL diisi dari
// AuthConfig saat constructor (cmd/server/main.go).
type Signer struct {
	secret      []byte
	accessTTL   time.Duration
	refreshTTL  time.Duration
	customerTTL time.Duration
	now         func() time.Time // override-able untuk test
}

// NewSigner buat Signer baru. secret minimal 32 byte agar HS256 cukup kuat.
// accessTTL & refreshTTL > 0; kalau 0 di-default ke 15m & 168h.
func NewSigner(secret string, accessTTL, refreshTTL time.Duration) *Signer {
	if accessTTL <= 0 {
		accessTTL = 15 * time.Minute
	}
	if refreshTTL <= 0 {
		refreshTTL = 7 * 24 * time.Hour
	}
	return &Signer{
		secret:      []byte(secret),
		accessTTL:   accessTTL,
		refreshTTL:  refreshTTL,
		customerTTL: 24 * time.Hour,
		now:         time.Now,
	}
}

// SetCustomerTTL override TTL access token customer portal (default 24h).
// Dipanggil dari cmd/server/main.go bila JWT_CUSTOMER_TTL di-set.
func (s *Signer) SetCustomerTTL(ttl time.Duration) {
	if ttl > 0 {
		s.customerTTL = ttl
	}
}

// CustomerTTL exposes the configured customer access-token lifetime.
func (s *Signer) CustomerTTL() time.Duration { return s.customerTTL }

// AccessTTL exposes the configured access-token lifetime (untuk response).
func (s *Signer) AccessTTL() time.Duration { return s.accessTTL }

// RefreshTTL exposes the configured refresh-token lifetime.
func (s *Signer) RefreshTTL() time.Duration { return s.refreshTTL }

// SignAccess generate JWT access token. jti diisi UUID baru — caller boleh
// log untuk audit tapi tidak perlu simpan (access token tidak di-blacklist).
func (s *Signer) SignAccess(userID uint, username, role string) (string, error) {
	now := s.now()
	claims := Claims{
		UserID:   userID,
		Username: username,
		Role:     role,
		TokenTyp: TokenTypeAccess,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.NewString(),
			Subject:   fmt.Sprintf("%d", userID),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTTL)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
}

// SignRefresh generate JWT refresh token. jti adalah ID yang disimpan ke
// refresh_tokens table untuk blacklist/rotation.
func (s *Signer) SignRefresh(userID uint, username, role, jti string) (string, time.Time, error) {
	now := s.now()
	expires := now.Add(s.refreshTTL)
	claims := Claims{
		UserID:   userID,
		Username: username,
		Role:     role,
		TokenTyp: TokenTypeRefresh,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			Subject:   fmt.Sprintf("%d", userID),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(expires),
		},
	}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
	return tok, expires, err
}

// VerifyAccess verify token sebagai access. Error ke ErrTokenExpired /
// ErrTokenInvalid / ErrTokenWrongType supaya caller bisa map ke 401 tepat.
func (s *Signer) VerifyAccess(token string) (*Claims, error) {
	c, err := s.parse(token)
	if err != nil {
		return nil, err
	}
	if c.TokenTyp != TokenTypeAccess {
		return nil, ErrTokenWrongType
	}
	return c, nil
}

// VerifyRefresh verify token sebagai refresh. Caller harus cek lebih lanjut
// ke refresh_tokens table (jti revoked?) sebelum issue token baru.
func (s *Signer) VerifyRefresh(token string) (*Claims, error) {
	c, err := s.parse(token)
	if err != nil {
		return nil, err
	}
	if c.TokenTyp != TokenTypeRefresh {
		return nil, ErrTokenWrongType
	}
	return c, nil
}

// SignCustomerAccess generate JWT access token untuk customer portal.
func (s *Signer) SignCustomerAccess(customerID uint, phone string) (string, error) {
	now := s.now()
	claims := CustomerClaims{
		CustomerID: customerID,
		Phone:      phone,
		TokenTyp:   TokenTypeCustomerAccess,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.NewString(),
			Subject:   fmt.Sprintf("cust:%d", customerID),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.customerTTL)),
		},
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.secret)
}

// VerifyCustomerAccess verify token sebagai customer access. Menolak token
// staff (typ != customer_access) dengan ErrTokenWrongType.
func (s *Signer) VerifyCustomerAccess(token string) (*CustomerClaims, error) {
	claims := &CustomerClaims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.secret, nil
	})
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, fmt.Errorf("%w: %v", ErrTokenInvalid, err)
	}
	if !parsed.Valid {
		return nil, ErrTokenInvalid
	}
	if claims.TokenTyp != TokenTypeCustomerAccess {
		return nil, ErrTokenWrongType
	}
	return claims, nil
}

func (s *Signer) parse(token string) (*Claims, error) {
	claims := &Claims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.secret, nil
	})
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrTokenExpired
		}
		return nil, fmt.Errorf("%w: %v", ErrTokenInvalid, err)
	}
	if !parsed.Valid {
		return nil, ErrTokenInvalid
	}
	return claims, nil
}

// NewJTI helper baru-kan UUID untuk caller (service.Login/Refresh).
func NewJTI() string { return uuid.NewString() }
