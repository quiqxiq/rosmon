package api

import (
	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/roslib-mikhmon/api/handler"
	"github.com/quiqxiq/roslib-mikhmon/api/middleware"
	"github.com/quiqxiq/roslib-mikhmon/docs"
	"github.com/quiqxiq/roslib-mikhmon/service/auth"
)

// RegisterRoutes memasang semua handler ke router group "/api/v1".
//
// Auth:
//   - /auth/login, /auth/refresh, /auth/logout — public (tidak butuh token).
//   - Semua endpoint lain butuh Bearer access token (RequireAuth).
//   - Role enforcement: admin > operator > viewer.
//   - admin: full access termasuk /auth/users CRUD + DELETE devices + reboot/shutdown.
//   - operator: CRUD hotspot/voucher/profile, command non-destructive.
//   - viewer: read-only (GET only, plus SSE).
//
// Kalau deps.AuthSigner nil → enforcement di-skip (test mode / standalone).
func RegisterRoutes(g *gin.RouterGroup, deps *Deps) {
	// ── Auth public endpoints (login/refresh/logout) ──────────────────────
	// Pasang IP rate limit (anon) di scope public auth.
	if deps.AuthService != nil {
		publicAuth := g.Group("")
		if deps.IPLimiter != nil {
			publicAuth.Use(middleware.RequirePerIPRate(deps.IPLimiter))
		}
		handler.NewAuth(deps.AuthService).RegisterPublic(publicAuth)
	}

	// ── Authenticated middleware chain ────────────────────────────────────
	// Order: RequireAuth → per-user rate → heavy-endpoint rate.
	// Kalau signer nil, chain = no-op (pass-through, dev mode).
	authChain := []gin.HandlerFunc{}
	if deps.AuthSigner != nil {
		authChain = append(authChain, middleware.RequireAuth(deps.AuthSigner))
	}
	if deps.UserLimiter != nil {
		authChain = append(authChain, middleware.RequirePerUserRate(deps.UserLimiter))
	}
	if deps.HeavyLimiter != nil {
		authChain = append(authChain, middleware.HeavyEndpointsRate(deps.HeavyLimiter))
	}

	// ── Auth protected: /auth/me + /auth/users CRUD (admin) ───────────────
	if deps.AuthService != nil {
		auth := g.Group("")
		for _, mw := range authChain {
			auth.Use(mw)
		}
		handler.NewAuth(deps.AuthService).RegisterProtected(auth)
		usersGroup := auth.Group("")
		if deps.AuthSigner != nil {
			usersGroup.Use(middleware.RequireRole(roleAdmin))
		}
		handler.NewUsers(deps.AuthService).Register(usersGroup)
	}

	// ── Device CRUD ───────────────────────────────────────────────────────
	// GET /devices dan GET /devices/:id — semua authenticated user.
	// POST, PUT, DELETE /devices — hanya admin (operasi credential sensitif).
	devicesGroup := g.Group("")
	for _, mw := range authChain {
		devicesGroup.Use(mw)
	}
	devicesAdminGroup := g.Group("")
	for _, mw := range authChain {
		devicesAdminGroup.Use(mw)
	}
	if deps.AuthSigner != nil {
		devicesAdminGroup.Use(middleware.RequireRole(roleAdmin))
	}
	handler.NewDevices(deps.DeviceStore, deps.DevMgr).RegisterSplit(devicesGroup, devicesAdminGroup)

	// ── Semua endpoint RouterOS di bawah device scope ─────────────────────
	dev := g.Group("/devices/:device_id")
	for _, mw := range authChain {
		dev.Use(mw)
	}
	dev.Use(middleware.DeviceMiddleware(deps.DevMgr))

	handler.NewSystemInfo(nil).Register(dev)
	handler.NewSystemLogging(nil).Register(dev)
	handler.NewSystemScript(nil).Register(dev)
	handler.NewSystemScheduler(nil).Register(dev)
	handler.NewLog(nil).Register(dev)

	// System control (reboot/shutdown) — hanya admin
	sysControlGroup := dev.Group("")
	if deps.AuthSigner != nil {
		sysControlGroup.Use(middleware.RequireRole(roleAdmin))
	}
	handler.NewSystemControl(nil).Register(sysControlGroup)

	handler.NewHotspotUser(nil, nil).Register(dev)
	handler.NewHotspotProfile(nil, nil).Register(dev)
	handler.NewHotspotServer(nil).Register(dev)
	handler.NewHotspotActive(nil, nil).Register(dev)
	handler.NewHotspotHost(nil).Register(dev)
	handler.NewHotspotCookie(nil).Register(dev)
	handler.NewHotspotBinding(nil, nil).Register(dev)
	handler.NewHotspotVoucher(nil).Register(dev)

	handler.NewNetworkInterface(nil).Register(dev)
	handler.NewNetworkPool(nil).Register(dev)
	handler.NewNetworkARP(nil).Register(dev)
	handler.NewNetworkDHCP(nil).Register(dev)
	handler.NewNetworkQueue(nil).Register(dev)

	handler.NewPPPSecret(nil).Register(dev)
	handler.NewPPPProfile(nil).Register(dev)
	handler.NewPPPActive(nil).Register(dev)

	handler.NewStream(deps.Hub, nil, nil, nil, nil, nil, nil).Register(dev)

	if deps.InfluxReader != nil {
		handler.NewHistory(deps.InfluxReader).Register(dev)
	}

	// Report API butuh DB stores langsung (bukan via ClientSet), jadi
	// register di group tersendiri TANPA DeviceMiddleware — supaya
	// laporan historis tetap bisa di-query meskipun router offline.
	// URL pattern sama (/devices/:device_id/reports/...) untuk
	// konsistensi dengan endpoint device lain.
	if deps.TxStore != nil && deps.DeviceStore != nil {
		reportScope := g.Group("/devices/:device_id")
		for _, mw := range authChain {
			reportScope.Use(mw)
		}
		handler.NewReport(deps.DeviceStore, deps.TxStore).Register(reportScope)
	}

	// ProfileConfig API: scope per-device tanpa DeviceMiddleware
	// — pakai DB lokal, tidak butuh router online.
	if deps.ProfileStore != nil {
		configScope := g.Group("/devices/:device_id")
		for _, mw := range authChain {
			configScope.Use(mw)
		}
		handler.NewProfileConfig(deps.ProfileStore).Register(configScope)
	}
}

// roleAdmin shortcut konstanta (avoid import cycle ke service/auth).
var roleAdmin = auth.RoleAdmin

// RegisterDocs mounts OpenAPI spec + interactive docs UI (Scalar).
// Register sebagai group di root router (bukan di /api/v1).
//
// Spec di-serve sebagai single bundled file (generated via `make openapi-bundle`,
// embedded via //go:embed). Scalar tidak handal resolve relative $ref lintas
// file di browser, jadi multi-file di docs/openapi/{paths,schemas,components}
// di-bundle ke openapi.bundle.yaml saat build, lalu di-embed ke binary.
func RegisterDocs(r *gin.Engine) {
	r.GET("/docs/openapi.yaml", func(c *gin.Context) {
		c.Data(200, "application/yaml; charset=utf-8", docs.OpenAPIBundle)
	})
	r.GET("/docs", func(c *gin.Context) {
		c.Data(200, "text/html; charset=utf-8", docs.ScalarIndexHTML)
	})
}
