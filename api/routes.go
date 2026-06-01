package api

import (
	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/api/middleware"
	"github.com/quiqxiq/rosmon/docs"
	"github.com/quiqxiq/rosmon/service/auth"
)

// RegisterRoutes memasang semua handler ke router group "/api/v1".
//
// Auth:
//   - /auth/login, /auth/refresh, /auth/logout — public (tidak butuh token).
//   - /hook/hotspot/login/:device_id — public webhook (router on-login script).
//     MVP: tanpa auth, tanpa rate limit. JANGAN expose ke internet publik.
//   - Semua endpoint lain butuh Bearer access token (RequireAuth).
//   - Role enforcement: admin > operator > viewer.
//   - admin: full access termasuk /auth/users CRUD + DELETE devices + reboot/shutdown.
//   - operator: CRUD hotspot/voucher/profile, command non-destructive.
//   - viewer: read-only (GET only, plus SSE).
//
// Kalau deps.AuthSigner nil → enforcement di-skip (test mode / standalone).
func RegisterRoutes(g *gin.RouterGroup, deps *Deps) {
	// ── Public webhook (router on-login) ──────────────────────────────────
	// PENTING: register SEBELUM auth chain di-pasang. Endpoint ini tidak
	// butuh JWT karena dipanggil oleh /tool/fetch dari MikroTik router.
	// Webhook dari MikroTik on-login. Tidak pakai JWT. Jika HOOK_SHARED_SECRET
	// di-set di env, request harus menyertakan header X-Rosmon-Secret yang cocok.
	if deps.TxStore != nil && deps.ProfileStore != nil && deps.DeviceStore != nil {
		hookGroup := g.Group("")
		handler.NewHookLogin(deps.DeviceStore, deps.TxStore, deps.ProfileStore, deps.HookSharedSecret, deps.Logger).
			Register(hookGroup)
	}

	// ── Public webhook Xendit (Fase 4) ────────────────────────────────────
	// POST /public/webhooks/xendit — diproteksi x-callback-token dari Xendit.
	// Tidak butuh JWT. Di-rate-limit per IP untuk mencegah flood.
	if deps.XenditGateway != nil {
		xenditWebhookGroup := g.Group("")
		if deps.IPLimiter != nil {
			xenditWebhookGroup.Use(middleware.RequirePerIPRate(deps.IPLimiter))
		}
		handler.NewXenditWebhook(
			deps.XenditGateway, deps.PaymentStore, deps.InvoiceStore,
			deps.SubscriptionStore, deps.CustomerStore,
			deps.NotificationService, deps.SettingStore, deps.Logger,
		).Register(xenditWebhookGroup)
	}

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
	handler.NewPingCount(nil).Register(dev)

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
		handler.NewProfileConfig(deps.ProfileStore, deps.DevMgr, deps.GoServiceURL, deps.Logger).Register(configScope)
	}

	// PPP profiles management (DB-backed).
	if deps.PPPProfileStore != nil {
		pppScope := g.Group("/devices/:device_id")
		for _, mw := range authChain {
			pppScope.Use(mw)
		}
		handler.NewPPPProfiles(deps.PPPProfileStore, deps.DevMgr, deps.Logger).Register(pppScope)
	}

	// Hotspot profiles management (DB-backed, permanent + voucher).
	if deps.HotspotStore != nil {
		hsScope := g.Group("/devices/:device_id")
		for _, mw := range authChain {
			hsScope.Use(mw)
		}
		handler.NewHotspotProfiles(deps.HotspotStore, deps.DevMgr, deps.GoServiceURL, deps.Logger).Register(hsScope)
	}

	// Customer / Subscription API — business layer.
	if deps.CustomerStore != nil {
		bizScope := g.Group("")
		for _, mw := range authChain {
			bizScope.Use(mw)
		}
		ch := handler.NewCustomers(deps.CustomerStore)
		ch.PortalAuth = deps.PortalAuth
		ch.Audit = deps.AuditLogStore
		ch.Register(bizScope)
		// set-portal-password + DELETE /customers/:id = admin+operator.
		adminOp := g.Group("")
		for _, mw := range authChain {
			adminOp.Use(mw)
		}
		if deps.AuthSigner != nil {
			adminOp.Use(middleware.RequireRole(roleAdmin, roleOperator))
		}
		ch.RegisterAdmin(adminOp)
		ch.RegisterMutate(adminOp)
	}
	if deps.SubscriptionStore != nil && deps.CustomerStore != nil {
		subScope := g.Group("")
		for _, mw := range authChain {
			subScope.Use(mw)
		}
		handler.NewSubscriptions(
			deps.SubscriptionStore, deps.CustomerStore,
			deps.PPPProfileStore, deps.HotspotStore,
			deps.SettingStore, deps.DevMgr, deps.Logger,
		).Register(subScope)
	}

	// Settings, Invoices, Payments — business layer billing.
	if deps.SettingStore != nil {
		bizAuth := g.Group("")
		for _, mw := range authChain {
			bizAuth.Use(mw)
		}
		handler.NewSettings(deps.SettingStore).Register(bizAuth)
	}
	if deps.InvoiceStore != nil && deps.SequenceStore != nil {
		// GET /invoices, GET /invoices/:id — semua authenticated user.
		invRead := g.Group("")
		for _, mw := range authChain {
			invRead.Use(mw)
		}
		h := handler.NewInvoices(deps.InvoiceStore, deps.SequenceStore)
		h.RegisterRead(invRead)
		// POST /invoices/generate, POST /invoices/:id/cancel — admin+operator saja.
		invWrite := g.Group("")
		for _, mw := range authChain {
			invWrite.Use(mw)
		}
		if deps.AuthSigner != nil {
			invWrite.Use(middleware.RequireRole(roleAdmin, roleOperator))
		}
		h.RegisterWrite(invWrite)
	}
	if deps.PaymentStore != nil && deps.InvoiceStore != nil {
		bizAuth := g.Group("")
		for _, mw := range authChain {
			bizAuth.Use(mw)
		}
		handler.NewPayments(deps.PaymentStore, deps.InvoiceStore, deps.SubscriptionStore,
			deps.CustomerStore, deps.NotificationService, deps.AuditLogStore, deps.SettingStore,
			deps.Logger).Register(bizAuth)
	}

	// Audit logs, message templates, notification logs, WhatsApp setup —
	// admin only. Read-only (audit/notifications) + template editing + WA setup.
	if deps.AuditLogStore != nil || deps.TemplateStore != nil || deps.NotificationStore != nil || deps.WhatsApp != nil {
		adminBiz := g.Group("")
		for _, mw := range authChain {
			adminBiz.Use(mw)
		}
		if deps.AuthSigner != nil {
			adminBiz.Use(middleware.RequireRole(roleAdmin))
		}
		if deps.AuditLogStore != nil {
			handler.NewAuditLogs(deps.AuditLogStore).Register(adminBiz)
		}
		if deps.TemplateStore != nil {
			handler.NewMessageTemplates(deps.TemplateStore).Register(adminBiz)
		}
		if deps.NotificationStore != nil {
			handler.NewNotifications(deps.NotificationStore).Register(adminBiz)
		}
		if deps.WhatsApp != nil {
			handler.NewWhatsApp(deps.WhatsApp).Register(adminBiz)
		}
	}

	// Registration flow (Fase 2): submit publik + manajemen staff.
	if deps.RegistrationStore != nil {
		regHandler := handler.NewRegistrations(
			deps.RegistrationStore, deps.CustomerStore, deps.SubscriptionStore,
			deps.BillingService, deps.NotificationService, deps.SettingStore,
			deps.AuditLogStore, deps.Logger,
		)
		// Zone publik (tanpa auth) — IP rate-limited.
		pub := g.Group("")
		if deps.IPLimiter != nil {
			pub.Use(middleware.RequirePerIPRate(deps.IPLimiter))
		}
		regHandler.RegisterPublic(pub)
		// Zone staff — admin + operator.
		staff := g.Group("")
		for _, mw := range authChain {
			staff.Use(mw)
		}
		if deps.AuthSigner != nil {
			staff.Use(middleware.RequireRole(roleAdmin, roleOperator))
		}
		regHandler.RegisterStaff(staff)
	}

	// Public packages (Fase 2): paket layanan untuk form pendaftaran publik.
	if deps.PPPProfileStore != nil || deps.HotspotStore != nil {
		pkgPub := g.Group("")
		if deps.IPLimiter != nil {
			pkgPub.Use(middleware.RequirePerIPRate(deps.IPLimiter))
		}
		handler.NewPublicPackages(deps.PPPProfileStore, deps.HotspotStore).RegisterPublic(pkgPub)
	}

	// Customer Portal (Fase 3) — scope JWT terpisah dari staff.
	if deps.PortalAuth != nil && deps.AuthSigner != nil {
		// Login publik (IP rate-limited).
		custPub := g.Group("")
		if deps.IPLimiter != nil {
			custPub.Use(middleware.RequirePerIPRate(deps.IPLimiter))
		}
		handler.NewCustomerAuth(deps.PortalAuth, deps.AuthSigner).RegisterPublic(custPub)

		// Endpoint portal (butuh customer access token).
		custScope := g.Group("")
		custScope.Use(middleware.RequireCustomerAuth(deps.AuthSigner))
		portalHandler := handler.NewCustomerPortal(
			deps.PortalAuth, deps.CustomerStore, deps.SubscriptionStore,
			deps.InvoiceStore, deps.PaymentStore,
		)
		// Wire payment gateway jika dikonfigurasi (Fase 4).
		portalHandler.PaymentSvc = deps.XenditGateway
		portalHandler.Register(custScope)
	}
}

// roleAdmin / roleOperator shortcut konstanta (avoid import cycle ke service/auth).
var (
	roleAdmin    = auth.RoleAdmin
	roleOperator = auth.RoleOperator
)

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
