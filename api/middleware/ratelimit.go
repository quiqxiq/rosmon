package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/roslib-mikhmon/api/dto"
	"github.com/quiqxiq/roslib-mikhmon/internal/ratelimit"
)

// RequirePerUserRate throttle per JWT user_id. Pasang setelah RequireAuth.
// Kalau claims tidak ada (mis. anon), fallback ke IP.
func RequirePerUserRate(lim *ratelimit.KeyedLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := userKey(c)
		if ok, wait := lim.Allow(key); !ok {
			respondRateLimited(c, wait, "user")
			return
		}
		c.Next()
	}
}

// RequirePerIPRate throttle per client IP. Dipakai untuk endpoint anon
// (login, healthz) sebelum auth context terbentuk.
func RequirePerIPRate(lim *ratelimit.KeyedLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := "ip:" + c.ClientIP()
		if ok, wait := lim.Allow(key); !ok {
			respondRateLimited(c, wait, "ip")
			return
		}
		c.Next()
	}
}

// RequirePerEndpointRate throttle per (user, endpoint-name). Dipakai
// untuk endpoint mahal (voucher generate, bulk-delete, reboot, shutdown).
// HARUS mount setelah RequireAuth.
func RequirePerEndpointRate(lim *ratelimit.KeyedLimiter, endpointName string) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := userKey(c) + ":" + endpointName
		if ok, wait := lim.Allow(key); !ok {
			respondRateLimited(c, wait, endpointName)
			return
		}
		c.Next()
	}
}

func userKey(c *gin.Context) string {
	if claims, ok := ClaimsFrom(c); ok {
		return fmt.Sprintf("user:%d", claims.UserID)
	}
	return "ip:" + c.ClientIP()
}

// HeavyEndpointsRate auto-detect endpoint mahal via path+method dan apply
// limit per (user, endpoint-name). Mount setelah RequireAuth + sebelum
// handler — biasanya di routes.go level.
//
// Endpoint yang dianggap "heavy":
//   - POST /devices/{id}/hotspot/vouchers/generate → "voucher_generate"
//   - POST /devices/{id}/hotspot/users/bulk-delete → "bulk_delete"
//   - POST /devices/{id}/system/reboot             → "reboot"
//   - POST /devices/{id}/system/shutdown           → "shutdown"
func HeavyEndpointsRate(lim *ratelimit.KeyedLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		endpoint := classifyHeavy(c.Request.Method, c.FullPath())
		if endpoint == "" {
			c.Next()
			return
		}
		key := userKey(c) + ":" + endpoint
		if ok, wait := lim.Allow(key); !ok {
			respondRateLimited(c, wait, endpoint)
			return
		}
		c.Next()
	}
}

// classifyHeavy → nama endpoint kalau path+method match list heavy, else "".
func classifyHeavy(method, fullPath string) string {
	if method != http.MethodPost {
		return ""
	}
	switch {
	case strings.HasSuffix(fullPath, "/hotspot/vouchers/generate"):
		return "voucher_generate"
	case strings.HasSuffix(fullPath, "/hotspot/users/bulk-delete"):
		return "bulk_delete"
	case strings.HasSuffix(fullPath, "/system/reboot"):
		return "reboot"
	case strings.HasSuffix(fullPath, "/system/shutdown"):
		return "shutdown"
	}
	return ""
}

func respondRateLimited(c *gin.Context, wait interface{ Seconds() float64 }, scope string) {
	secs := int(wait.Seconds())
	if secs < 1 {
		secs = 1
	}
	c.Header("Retry-After", strconv.Itoa(secs))
	c.AbortWithStatusJSON(http.StatusTooManyRequests,
		dto.ErrDetails("RATE_LIMIT", "too many requests, slow down",
			c.Request.URL.Path,
			map[string]any{"retry_after_s": secs, "scope": scope}))
}
