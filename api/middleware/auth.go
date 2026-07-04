package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/service/auth"
)

// CtxKeyClaims adalah gin.Context key untuk *auth.Claims set oleh RequireAuth.
const CtxKeyClaims = "auth_claims"

// CtxKeyCustomerClaims adalah gin.Context key untuk *auth.CustomerClaims set
// oleh RequireCustomerAuth.
const CtxKeyCustomerClaims = "customer_claims"

// RequireAuth verify Bearer token. Set claims ke context kalau valid.
// 401 + WWW-Authenticate header kalau token absent / invalid / expired.
//
// Fallback: kalau Authorization header tidak ada, cek query param ?access_token=.
// Ini dibutuhkan untuk SSE (EventSource) yang tidak bisa kirim custom header.
func RequireAuth(signer *auth.Signer) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := extractBearerOrQuery(c)
		if !ok {
			abortUnauthorized(c, "missing or malformed Authorization")
			return
		}
		claims, err := signer.VerifyAccess(token)
		if err != nil {
			switch {
			case errors.Is(err, auth.ErrTokenExpired):
				abortUnauthorized(c, "token expired")
			case errors.Is(err, auth.ErrTokenWrongType):
				abortUnauthorized(c, "wrong token type (refresh used as access?)")
			default:
				abortUnauthorized(c, "invalid token")
			}
			return
		}
		c.Set(CtxKeyClaims, claims)
		c.Next()
	}
}

// RequireRole memastikan claims.Role match salah satu role yang diizinkan.
// HARUS di-mount setelah RequireAuth. 403 kalau role tidak match.
func RequireRole(roles ...string) gin.HandlerFunc {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}
	return func(c *gin.Context) {
		claims, ok := ClaimsFrom(c)
		if !ok {
			abortUnauthorized(c, "no authentication context (RequireAuth missing?)")
			return
		}
		if _, has := allowed[claims.Role]; !has {
			c.AbortWithStatusJSON(http.StatusForbidden,
				dto.Err("FORBIDDEN", "role not authorized for this action", c.Request.URL.Path))
			return
		}
		c.Next()
	}
}

// ClaimsFrom mengambil claims dari gin.Context (set oleh RequireAuth).
// Return ok=false kalau belum di-set.
func ClaimsFrom(c *gin.Context) (*auth.Claims, bool) {
	v, ok := c.Get(CtxKeyClaims)
	if !ok {
		return nil, false
	}
	claims, ok := v.(*auth.Claims)
	return claims, ok
}

// RequireCustomerAuth verify Bearer token sebagai customer access token (scope
// portal pelanggan, TERPISAH dari staff). Token staff ditolak (typ mismatch).
func RequireCustomerAuth(signer *auth.Signer) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := extractBearerOrQuery(c)
		if !ok {
			abortUnauthorized(c, "missing or malformed Authorization")
			return
		}
		claims, err := signer.VerifyCustomerAccess(token)
		if err != nil {
			switch {
			case errors.Is(err, auth.ErrTokenExpired):
				abortUnauthorized(c, "token expired")
			case errors.Is(err, auth.ErrTokenWrongType):
				abortUnauthorized(c, "wrong token type (staff token used on customer portal?)")
			default:
				abortUnauthorized(c, "invalid token")
			}
			return
		}
		c.Set(CtxKeyCustomerClaims, claims)
		c.Next()
	}
}

// RequireAnyAuth menerima token staff (auth.Claims) ATAU token customer
// (auth.CustomerClaims). Dipakai untuk endpoint yang perlu diakses keduanya
// — mis. /uploads/* untuk serve bukti pembayaran.
// Staff valid → set CtxKeyClaims. Customer valid → set CtxKeyCustomerClaims.
// Keduanya gagal → 401.
// Support ?access_token= query param (untuk <img src> yang tidak bisa set header).
func RequireAnyAuth(signer *auth.Signer) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, ok := extractBearerOrQuery(c)
		if !ok {
			abortUnauthorized(c, "missing or malformed Authorization")
			return
		}
		// Coba staff JWT dulu.
		if claims, err := signer.VerifyAccess(token); err == nil {
			c.Set(CtxKeyClaims, claims)
			c.Next()
			return
		}
		// Coba customer JWT.
		if custClaims, err := signer.VerifyCustomerAccess(token); err == nil {
			c.Set(CtxKeyCustomerClaims, custClaims)
			c.Next()
			return
		}
		abortUnauthorized(c, "invalid token")
	}
}

// CustomerClaimsFrom mengambil customer claims dari gin.Context.
func CustomerClaimsFrom(c *gin.Context) (*auth.CustomerClaims, bool) {
	v, ok := c.Get(CtxKeyCustomerClaims)
	if !ok {
		return nil, false
	}
	claims, ok := v.(*auth.CustomerClaims)
	return claims, ok
}

// extractBearerOrQuery mencoba extract token dari Authorization header,
// jika tidak ada fallback ke query param ?access_token= (untuk SSE dan img src).
func extractBearerOrQuery(c *gin.Context) (string, bool) {
	if token, ok := extractBearer(c.GetHeader("Authorization")); ok {
		return token, true
	}
	if qt := strings.TrimSpace(c.Query("access_token")); qt != "" {
		return qt, true
	}
	return "", false
}

// extractBearer parse "Bearer <token>" → token. Case-insensitive prefix.
func extractBearer(header string) (string, bool) {
	if header == "" {
		return "", false
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 {
		return "", false
	}
	if !strings.EqualFold(parts[0], "Bearer") {
		return "", false
	}
	tok := strings.TrimSpace(parts[1])
	if tok == "" {
		return "", false
	}
	return tok, true
}

func abortUnauthorized(c *gin.Context, msg string) {
	c.Header("WWW-Authenticate", `Bearer realm="api"`)
	c.AbortWithStatusJSON(http.StatusUnauthorized,
		dto.Err("UNAUTHORIZED", msg, c.Request.URL.Path))
}
