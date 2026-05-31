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
		header := c.GetHeader("Authorization")
		token, ok := extractBearer(header)
		if !ok {
			// Fallback: SSE clients pass token via ?access_token=<jwt>
			if qt := strings.TrimSpace(c.Query("access_token")); qt != "" {
				token, ok = qt, true
			}
		}
		if !ok {
			abortUnauthorized(c, "missing or malformed Authorization header")
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
		token, ok := extractBearer(c.GetHeader("Authorization"))
		if !ok {
			if qt := strings.TrimSpace(c.Query("access_token")); qt != "" {
				token, ok = qt, true
			}
		}
		if !ok {
			abortUnauthorized(c, "missing or malformed Authorization header")
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

// CustomerClaimsFrom mengambil customer claims dari gin.Context.
func CustomerClaimsFrom(c *gin.Context) (*auth.CustomerClaims, bool) {
	v, ok := c.Get(CtxKeyCustomerClaims)
	if !ok {
		return nil, false
	}
	claims, ok := v.(*auth.CustomerClaims)
	return claims, ok
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
