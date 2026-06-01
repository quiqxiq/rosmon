// Package api menyediakan HTTP layer (gin) di atas mikrotik/* + workflows/.
// Entry point pakai cmd/server/main.go yang inject Deps lalu panggil NewServer.
package api

import (
	roslibinflux "github.com/quiqxiq/roslib/metrics/influx"
	"github.com/quiqxiq/rosmon/api/sse"
	"github.com/quiqxiq/rosmon/internal/config"
	"github.com/quiqxiq/rosmon/internal/ratelimit"
	"github.com/quiqxiq/rosmon/service/auth"
	"github.com/quiqxiq/rosmon/service/billing"
	"github.com/quiqxiq/rosmon/service/devmgr"
	"github.com/quiqxiq/rosmon/service/notification"
	"github.com/quiqxiq/rosmon/service/notification/whatsapp"
	paymentSvc "github.com/quiqxiq/rosmon/service/payment"
	"github.com/quiqxiq/rosmon/service/portal"
	"github.com/quiqxiq/rosmon/store"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// Deps dipakai oleh cmd/server/main.go untuk meng-assemble handler.
type Deps struct {
	Logger     *logrus.Logger
	HTTPConfig *config.HTTPConfig
	DB         *gorm.DB

	// Stores
	DeviceStore       store.DeviceStore
	TxStore           store.TransactionStore
	ProfileStore      store.HotspotProfileStore
	CustomerStore     store.CustomerStore
	PPPProfileStore   store.PPPProfileStore
	HotspotStore      store.HotspotProfileStore
	SubscriptionStore store.SubscriptionStore
	SettingStore      store.SettingStore
	SequenceStore     store.SequenceStore
	InvoiceStore      store.InvoiceStore
	PaymentStore      store.PaymentStore
	AuditLogStore     store.AuditLogStore
	TemplateStore     store.TemplateStore
	NotificationStore store.NotificationLogStore

	// WhatsApp gateway manager (embedded whatsmeow). Nil → endpoint
	// /whatsapp/* mengembalikan 503 dan notifikasi di-skip/failed.
	WhatsApp *whatsapp.Manager

	// Registration flow (Fase 2). Nil → endpoint registrasi tidak di-mount.
	RegistrationStore   store.RegistrationStore
	NotificationService *notification.Service
	BillingService      *billing.Service

	// Customer portal (Fase 3). Nil → zona /api/customer/* tidak di-mount.
	PortalAuth *portal.CustomerAuth

	// Payment gateway (Fase 4). Nil → endpoint /customer/invoices/:id/pay mengembalikan 503
	// dan webhook /public/webhooks/xendit tidak di-mount.
	XenditGateway *paymentSvc.Service

	// Auth (Phase 2). Nil → routes /auth/* tidak di-mount dan
	// proteksi route lain di-skip. Production wajib set.
	AuthService *auth.Service
	AuthSigner  *auth.Signer

	// Rate limiters (Phase 4). Nil → enforcement di-skip.
	UserLimiter  *ratelimit.KeyedLimiter // per JWT user
	IPLimiter    *ratelimit.KeyedLimiter // per client IP (anon endpoints)
	HeavyLimiter *ratelimit.KeyedLimiter // per (user, endpoint) untuk endpoint mahal

	// Device Manager — mengelola koneksi ke semua router
	DevMgr *devmgr.Manager

	// SSE Hub — shared real-time broker
	Hub *sse.Hub

	// InfluxReader untuk history query API. Nil jika INFLUX_ENABLED=false.
	InfluxReader *roslibinflux.Reader

	// GoServiceURL adalah URL absolut Go service yang reachable dari
	// MikroTik router (mis. "http://192.168.1.10:8080"). Digunakan oleh
	// handler ProfileConfig untuk membentuk webhook URL di on-login
	// script. Boleh kosong → webhook block di-skip (selling record
	// di-bypass). Sumber: env GO_SERVICE_URL.
	GoServiceURL string

	// HookSharedSecret adalah nilai yang harus dikirim router via header
	// X-Rosmon-Secret saat POST ke /hook/hotspot/login/:device_id.
	// Kosong = tidak ada validasi (backward compat / dev mode).
	// Sumber: env HOOK_SHARED_SECRET.
	HookSharedSecret string
}
