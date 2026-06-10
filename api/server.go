package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/api/middleware"
	"github.com/quiqxiq/rosmon/api/sse"
)

// NewServer membangun gin engine dengan middleware default + register
// semua route via RegisterRoutes. Kembalikan http.Handler agar caller
// (cmd/server) bisa bungkus ke http.Server custom (timeout, dll).
//
// Middleware chain (urutan penting):
//  1. Recovery — paling luar, tangkap panic dari semua handler & middleware lain.
//  2. RequestID — set X-Request-ID sebelum Logger supaya log entry berisi ID.
//  3. Logger — log per-request setelah handler selesai.
//  4. CORS — preflight check; harus sebelum route group.
func NewServer(deps *Deps) http.Handler {
	if deps.Hub == nil {
		deps.Hub = sse.NewHub()
	}

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	r.Use(middleware.Recovery(deps.Logger))
	r.Use(middleware.RequestID())
	r.Use(middleware.Logger(deps.Logger))
	if deps.HTTPConfig != nil {
		r.Use(middleware.CORS(deps.HTTPConfig.CORSOrigins))
	}

	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, dto.Err("NOT_FOUND", "route not found", c.Request.URL.Path))
	})
	r.NoMethod(func(c *gin.Context) {
		c.JSON(http.StatusMethodNotAllowed, dto.Err("METHOD_NOT_ALLOWED", "method not allowed", c.Request.URL.Path))
	})

	r.HandleMethodNotAllowed = true

	// Health probe — di-extend dengan dependency check di healthz.go.
	r.GET("/healthz", healthzHandler(deps))

	// Interactive API docs (Rapidoc UI + OpenAPI spec).
	// Path: /docs → UI, /docs/openapi.yaml → raw spec.
	RegisterDocs(r)

	// Serve static files for proof of payment uploads
	r.Static("/uploads", "./uploads")

	v1 := r.Group("/api/v1")
	RegisterRoutes(v1, deps)

	return r
}
