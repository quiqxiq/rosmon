package middleware

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// CORS membangun gin-contrib/cors config dengan origins yang di-allow.
//
// Origins behavior:
//   - len(origins) == 0  → no-op middleware (same-origin only). Browser
//     akan tolak request cross-origin karena tidak ada header CORS yang
//     di-emit. Default produksi yang aman.
//   - origins == ["*"]   → AllowAllOrigins=true. Hanya boleh untuk dev.
//   - len(origins) > 0   → AllowOrigins=origins (allowlist eksplisit).
//
// AllowCredentials sengaja false — kalau auth via cookie/session di-implement,
// perlu set AllowCredentials=true tapi WAJIB pakai allowlist eksplisit
// (browser tolak credentials dengan wildcard).
func CORS(origins []string) gin.HandlerFunc {
	if len(origins) == 0 {
		// Same-origin only — middleware no-op tidak emit Access-Control-* headers.
		return func(c *gin.Context) { c.Next() }
	}
	cfg := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", HeaderRequestID},
		ExposeHeaders:    []string{HeaderRequestID},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}
	if len(origins) == 1 && origins[0] == "*" {
		cfg.AllowAllOrigins = true
	} else {
		cfg.AllowOrigins = origins
	}
	return cors.New(cfg)
}
