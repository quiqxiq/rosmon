// Command server adalah entry point HTTP API + SSE rosmon.
//
// Lifecycle:
//
//  1. Load config HTTP + DB via env (lihat .env.example).
//  2. Buka koneksi PostgreSQL + jalankan AutoMigrate.
//  3. Build stores (device, transaction, profile_config).
//  4. Build DeviceManager — load semua device dari DB, dial koneksi RouterOS.
//  5. Build ExpiryService — spawn per-device goroutine pemeriksa expiry.
//  6. Build api.Server (gin engine + middleware + routes + SSE hub).
//  7. http.Server.ListenAndServe + graceful shutdown via SIGINT/SIGTERM.
package main

import (
	"context"
	"encoding/hex"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	roslibcfg "github.com/quiqxiq/roslib/config"
	roslibinflux "github.com/quiqxiq/roslib/metrics/influx"
	"github.com/quiqxiq/rosmon/api"
	"github.com/quiqxiq/rosmon/api/sse"
	"github.com/quiqxiq/rosmon/internal/config"
	"github.com/quiqxiq/rosmon/internal/ratelimit"
	"github.com/quiqxiq/rosmon/job"
	"github.com/quiqxiq/rosmon/service/auth"
	"github.com/quiqxiq/rosmon/service/billing"
	"github.com/quiqxiq/rosmon/service/devmgr"
	"github.com/quiqxiq/rosmon/service/expiry"
	"github.com/quiqxiq/rosmon/service/metrics"
	"github.com/quiqxiq/rosmon/service/notification"
	"github.com/quiqxiq/rosmon/service/notification/whatsapp"
	"github.com/quiqxiq/rosmon/service/portal"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
)

func main() {
	log := logrus.New()
	log.SetLevel(logrus.InfoLevel)
	log.SetFormatter(&logrus.JSONFormatter{})

	// Best-effort load .env — kalau tidak ada, lanjut pakai env system.
	dotenvPath := os.Getenv("DOTENV_FILE")
	if dotenvPath == "" {
		dotenvPath = ".env"
	}
	if err := godotenv.Load(dotenvPath); err == nil {
		log.WithField("file", dotenvPath).Info("loaded .env")
	}

	// LOG_LEVEL via env: debug, info, warn, error, fatal. Default info.
	// Harus di-set setelah godotenv.Load supaya bisa dikontrol dari .env.
	if lvl, err := logrus.ParseLevel(os.Getenv("LOG_LEVEL")); err == nil {
		log.SetLevel(lvl)
		log.WithField("level", lvl.String()).Debug("log level set")
	}

	// DEVICE_PASSWORD_KEY: AES-256-GCM key untuk enkripsi password router.
	// Opsional tapi sangat direkomendasikan di production.
	// Lihat .env.example untuk cara generate.
	if keyHex := os.Getenv("DEVICE_PASSWORD_KEY"); keyHex != "" {
		key, hexErr := hex.DecodeString(keyHex)
		if hexErr != nil || len(key) != 32 {
			log.Warn("DEVICE_PASSWORD_KEY tidak valid — harus 64 hex chars (32 byte). Gunakan 'openssl rand -hex 32' untuk generate. Password device disimpan plaintext.")
		} else {
			if err := store.SetDeviceCryptoKey(key); err != nil {
				log.WithError(err).Fatal("invalid DEVICE_PASSWORD_KEY")
			}
			log.Info("device password encryption enabled")
		}
	} else {
		log.Warn("DEVICE_PASSWORD_KEY tidak di-set — password device disimpan plaintext")
	}

	httpCfg, err := config.LoadHTTPFromEnv()
	if err != nil {
		log.WithError(err).Fatal("load http config")
	}
	dbCfg := config.LoadDBFromEnv()
	authCfg, err := config.LoadAuthFromEnv()
	if err != nil {
		log.WithError(err).Fatal("load auth config")
	}
	rateCfg := config.LoadRateLimitFromEnv()

	rootCtx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	// ── Database ──────────────────────────────────────────────────────────
	db, err := store.Open(dbCfg.DSN())
	if err != nil {
		log.WithError(err).Fatal("open database")
	}
	if err := store.Migrate(db); err != nil {
		log.WithError(err).Fatal("migrate database")
	}
	log.Info("database ready")

	// ── Stores ────────────────────────────────────────────────────────────
	deviceStore := store.NewDeviceStore(db)
	txStore := store.NewTransactionStore(db)
	userStore := store.NewUserStore(db)
	refreshStore := store.NewRefreshTokenStore(db)
	customerStore := store.NewCustomerStore(db)
	pppProfileStore := store.NewPPPProfileStore(db)
	hotspotProfileStore := store.NewHotspotProfileStore(db)
	subscriptionStore := store.NewSubscriptionStore(db)
	settingStore := store.NewSettingStore(db)
	sequenceStore := store.NewSequenceStore(db)
	invoiceStore := store.NewInvoiceStore(db)
	paymentStore := store.NewPaymentStore(db)
	auditLogStore := store.NewAuditLogStore(db)
	templateStore := store.NewTemplateStore(db)
	notificationStore := store.NewNotificationLogStore(db)
	registrationStore := store.NewRegistrationStore(db)

	// ── Auth Service ──────────────────────────────────────────────────────
	authSigner := auth.NewSigner(authCfg.JWTSecret, authCfg.AccessTTL, authCfg.RefreshTTL)
	if v := strings.TrimSpace(os.Getenv("JWT_CUSTOMER_TTL")); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			authSigner.SetCustomerTTL(d)
		}
	}
	authHasher := auth.NewHasher(authCfg.BcryptCost)
	authSvc := auth.New(userStore, refreshStore, authHasher, authSigner)

	// ── Customer Portal auth (Fase 3) ─────────────────────────────────────
	portalAuth := portal.New(portal.Deps{
		Customers: customerStore,
		Hasher:    authHasher,
		Signer:    authSigner,
	})
	if err := authSvc.BootstrapAdmin(rootCtx, authCfg.AdminUsername, authCfg.AdminPassword); err != nil {
		log.WithError(err).Warn("bootstrap admin failed (may already exist)")
	} else if authCfg.AdminUsername != "" {
		log.WithField("username", authCfg.AdminUsername).Info("admin bootstrap checked")
	}

	// ── Device Manager ────────────────────────────────────────────────────
	devMgr := devmgr.New(deviceStore, log)
	if err := devMgr.Start(rootCtx); err != nil {
		log.WithError(err).Fatal("start device manager")
	}

	// ── Expiry Service ────────────────────────────────────────────────────
	expSvc := expiry.New(devMgr, deviceStore, hotspotProfileStore, txStore, log)
	if err := expSvc.Start(rootCtx); err != nil {
		log.WithError(err).Fatal("start expiry service")
	}

	// ── Notification service + WhatsApp (whatsmeow embedded) ──────────────
	// Sesi WhatsApp disimpan persisten di Postgres (sqlstore). Kalau gagal
	// start, server tetap jalan — notifikasi di-skip/failed & bisa di-retry.
	notifCfg := config.LoadNotificationFromEnv()
	var waManager *whatsapp.Manager
	if sqlDB, errDB := db.DB(); errDB != nil {
		log.WithError(errDB).Warn("notification: gagal ambil *sql.DB — WhatsApp dinonaktifkan")
	} else {
		waManager = whatsapp.New(whatsapp.Deps{DB: sqlDB, CountryCode: notifCfg.WACountryCode, Log: log})
		if err := waManager.Start(rootCtx); err != nil {
			log.WithError(err).Warn("notification: whatsapp manager start gagal (lanjut tanpa WA)")
		}
	}
	var notifSender notification.Sender
	if waManager != nil {
		notifSender = waManager
	}
	notifSvc := notification.New(notification.Deps{
		Sender:    notifSender,
		Templates: templateStore,
		Logs:      notificationStore,
		Settings:  settingStore,
		Log:       log,
	})

	// ── Background Jobs ──────────────────────────────────────────────────
	outboxJob := job.NewOutboxJob(subscriptionStore, pppProfileStore, hotspotProfileStore, settingStore, devMgr, log)
	outboxJob.Start(rootCtx)
	log.Info("outbox job started")

	billingSvc := billing.New(billing.Deps{
		Invoices:  invoiceStore,
		Sequences: sequenceStore,
		PPP:       pppProfileStore,
		Hotspot:   hotspotProfileStore,
	})
	billingCron := job.NewBillingCronJob(subscriptionStore, customerStore, settingStore, billingSvc, notifSvc, log)
	startDailyJob(rootCtx, 7, 0, "billing_cron", billingCron.Run, log)

	suspCheck := job.NewSuspensionCheckJob(subscriptionStore, customerStore, invoiceStore, settingStore, notifSvc, log)
	startDailyJob(rootCtx, 9, 0, "suspension_check", suspCheck.Run, log)

	notifRetry := job.NewNotifRetryJob(notifSvc, log)
	notifRetry.Start(rootCtx)
	log.Info("notif_retry job started")

	// ── InfluxDB3 + Metrics Service ───────────────────────────────────────
	influxCfg := roslibcfg.InfluxConfig{
		Enabled:  os.Getenv("INFLUX_ENABLED") == "true",
		Host:     os.Getenv("INFLUX_HOST"),
		Token:    os.Getenv("INFLUX_TOKEN"),
		Database: os.Getenv("INFLUX_DATABASE"),
	}
	var metricsSvc *metrics.Service
	var influxReader *roslibinflux.Reader
	if influxCfg.Enabled {
		influxCli, err := roslibinflux.NewClient(influxCfg)
		if err != nil {
			log.WithError(err).Fatal("init influx client")
		}
		defer influxCli.Close()
		influxReader = roslibinflux.NewReader(influxCli)
		metricsSvc = metrics.New(influxCli, devMgr, log)
		metricsSvc.Start(rootCtx)
		log.Info("influx metrics started")
	}

	// Wire device lifecycle hooks — expiry + metrics keduanya
	devMgr.OnDeviceConnected = func(d model.MikrotikDevice) {
		expSvc.StartDevice(d)
		if metricsSvc != nil {
			metricsSvc.StartDevice(d)
		}
	}
	devMgr.OnDeviceRemoved = func(deviceID uint) {
		expSvc.StopDevice(deviceID)
		if metricsSvc != nil {
			metricsSvc.StopDevice(deviceID)
		}
	}

	// ── Rate limiters & SSE hub caps ──────────────────────────────────────
	// RPM → rps via /60. Burst = RPM (allow short spike sebesar 1 menit quota).
	userLim := ratelimit.New(float64(rateCfg.UserRPM)/60, rateCfg.UserRPM, 10*time.Minute)
	ipLim := ratelimit.New(float64(rateCfg.IPRPM)/60, rateCfg.IPRPM, 10*time.Minute)
	heavyLim := ratelimit.New(float64(rateCfg.HeavyRPM)/60, rateCfg.HeavyRPM, 10*time.Minute)
	defer userLim.Close()
	defer ipLim.Close()
	defer heavyLim.Close()

	hub := sse.NewHubWithCaps(rateCfg.SSEMaxPerTopic, rateCfg.SSEMaxPerDevice)

	// GO_SERVICE_URL: URL absolut Go service yang reachable dari MikroTik
	// router. Dipakai untuk membentuk webhook URL di on-login script.
	// Kalau kosong, webhook block tidak di-emit di script (selling record
	// di-skip). Format: "http://<host>:<port>" tanpa path.
	goServiceURL := strings.TrimSpace(os.Getenv("GO_SERVICE_URL"))
	if goServiceURL == "" {
		log.Warn("GO_SERVICE_URL not set — selling record webhook akan di-skip di on-login script")
	} else {
		log.WithField("url", goServiceURL).Info("on-login webhook target")
	}

	// HOOK_SHARED_SECRET: secret untuk validasi webhook dari MikroTik router.
	// Jika di-set, router harus mengirim header X-Rosmon-Secret dengan nilai ini.
	hookSecret := strings.TrimSpace(os.Getenv("HOOK_SHARED_SECRET"))
	if hookSecret == "" {
		log.Warn("HOOK_SHARED_SECRET tidak di-set — webhook /hook/hotspot/login tidak tervalidasi (development mode)")
	} else {
		log.Info("hook shared secret configured")
	}

	// ── HTTP Server ───────────────────────────────────────────────────────
	deps := &api.Deps{
		Logger:            log,
		HTTPConfig:        httpCfg,
		DB:                db,
		DeviceStore:       deviceStore,
		TxStore:           txStore,
		ProfileStore:      hotspotProfileStore,
		CustomerStore:     customerStore,
		PPPProfileStore:   pppProfileStore,
		HotspotStore:      hotspotProfileStore,
		SubscriptionStore: subscriptionStore,
		SettingStore:      settingStore,
		SequenceStore:     sequenceStore,
		InvoiceStore:      invoiceStore,
		PaymentStore:      paymentStore,
		AuditLogStore:     auditLogStore,
		TemplateStore:     templateStore,
		NotificationStore: notificationStore,
		WhatsApp:          waManager,

		RegistrationStore:   registrationStore,
		NotificationService: notifSvc,
		BillingService:      billingSvc,
		PortalAuth:          portalAuth,
		AuthService:         authSvc,
		AuthSigner:          authSigner,
		UserLimiter:         userLim,
		IPLimiter:           ipLim,
		HeavyLimiter:        heavyLim,
		DevMgr:              devMgr,
		Hub:                 hub,
		InfluxReader:        influxReader,
		GoServiceURL:        goServiceURL,
		HookSharedSecret:    hookSecret,
	}

	handler := api.NewServer(deps)

	httpSrv := &http.Server{
		Addr:        httpCfg.Bind,
		Handler:     handler,
		ReadTimeout: httpCfg.ReadTimeout,
		// WriteTimeout sengaja 0: SSE butuh long-lived connection.
		WriteTimeout: 0,
		IdleTimeout:  httpCfg.IdleTimeout,
	}

	serverErr := make(chan error, 1)
	go func() {
		log.WithField("bind", httpCfg.Bind).Info("http server listening")
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErr <- err
		}
		close(serverErr)
	}()

	select {
	case <-rootCtx.Done():
		log.Info("shutdown signal received")
	case err := <-serverErr:
		if err != nil {
			log.WithError(err).Fatal("http server crashed")
		}
	}

	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), httpCfg.ShutdownGrace)
	defer cancelShutdown()
	if err := httpSrv.Shutdown(shutdownCtx); err != nil {
		log.WithError(err).Warn("http shutdown error")
	}
	log.Info("server stopped")
}

// startDailyJob spawns a goroutine that runs jobFn once per day at targetHour:targetMin (local time).
func startDailyJob(ctx context.Context, targetHour, targetMin int, name string, jobFn func(context.Context) error, log *logrus.Logger) {
	go func() {
		for {
			now := time.Now()
			next := time.Date(now.Year(), now.Month(), now.Day(), targetHour, targetMin, 0, 0, now.Location())
			if !next.After(now) {
				next = next.Add(24 * time.Hour)
			}
			select {
			case <-ctx.Done():
				return
			case <-time.After(time.Until(next)):
				log.WithField("job", name).Info("daily job started")
				if err := jobFn(ctx); err != nil {
					log.WithError(err).WithField("job", name).Warn("daily job error")
				}
			}
		}
	}()
	log.WithFields(logrus.Fields{"job": name, "hour": targetHour, "min": targetMin}).Info("daily job scheduled")
}
