package api

import (
	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/roslib-mikhmon/api/handler"
	"github.com/quiqxiq/roslib-mikhmon/api/middleware"
	"github.com/quiqxiq/roslib-mikhmon/service/auth"
)

// RegisterRoutes memasang semua handler ke router group "/api/v1".
//
// Auth:
//   - /auth/login, /auth/refresh, /auth/logout — public (tidak butuh token).
//   - Semua endpoint lain butuh Bearer access token (RequireAuth).
//   - Role enforcement: admin > operator > viewer.
//     - admin: full access termasuk /auth/users CRUD + DELETE devices + reboot/shutdown.
//     - operator: CRUD hotspot/voucher/profile, command non-destructive.
//     - viewer: read-only (GET only, plus SSE).
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
	devicesGroup := g.Group("")
	for _, mw := range authChain {
		devicesGroup.Use(mw)
	}
	handler.NewDevices(deps.DeviceStore, deps.DevMgr).Register(devicesGroup)

	// ── Semua endpoint RouterOS di bawah device scope ─────────────────────
	dev := g.Group("/devices/:device_id")
	for _, mw := range authChain {
		dev.Use(mw)
	}
	dev.Use(middleware.DeviceMiddleware(deps.DevMgr))

	handler.NewSystemInfo(nil).Register(dev)
	handler.NewSystemControl(nil).Register(dev)
	handler.NewSystemLogging(nil).Register(dev)
	handler.NewSystemScript(nil).Register(dev)
	handler.NewSystemScheduler(nil).Register(dev)
	handler.NewLog(nil).Register(dev)

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

	handler.NewStream(deps.Hub, nil, nil, nil, nil, nil).Register(dev)

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
func RegisterDocs(r *gin.Engine) {
	// Serve seluruh direktori openapi/ agar Scalar bisa resolve
	// relative $ref (schemas/*.yaml, paths/*.yaml).
	r.Static("/docs/openapi", "docs/openapi")
	// Serve Scalar UI
	r.StaticFile("/docs", "docs/scalar/index.html")
}
