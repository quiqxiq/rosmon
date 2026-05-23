// Command server adalah entry point HTTP API + SSE roslib-mikhmon.
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
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/quiqxiq/roslib-mikhmon/api"
	"github.com/quiqxiq/roslib-mikhmon/api/sse"
	"github.com/quiqxiq/roslib-mikhmon/internal/config"
	"github.com/quiqxiq/roslib-mikhmon/internal/ratelimit"
	"github.com/quiqxiq/roslib-mikhmon/service/auth"
	"github.com/quiqxiq/roslib-mikhmon/service/devmgr"
	"github.com/quiqxiq/roslib-mikhmon/service/expiry"
	"github.com/quiqxiq/roslib-mikhmon/service/metrics"
	"github.com/quiqxiq/roslib-mikhmon/store"
	"github.com/quiqxiq/roslib-mikhmon/store/model"
	roslibcfg "github.com/quiqxiq/roslib/config"
	roslibinflux "github.com/quiqxiq/roslib/metrics/influx"
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
		key := make([]byte, 0, 32)
		if _, err := fmt.Sscanf(keyHex, "%x", &key); err == nil && len(key) == 32 {
			if err := store.SetDeviceCryptoKey(key); err != nil {
				log.WithError(err).Fatal("invalid DEVICE_PASSWORD_KEY")
			}
			log.Info("device password encryption enabled")
		} else {
			log.Warn("DEVICE_PASSWORD_KEY tidak valid — abaikan (password tidak terenkripsi). Gunakan 'openssl rand -hex 32' untuk generate.")
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
	profileStore := store.NewProfileConfigStore(db)
	userStore := store.NewUserStore(db)
	refreshStore := store.NewRefreshTokenStore(db)

	// ── Auth Service ──────────────────────────────────────────────────────
	authSigner := auth.NewSigner(authCfg.JWTSecret, authCfg.AccessTTL, authCfg.RefreshTTL)
	authHasher := auth.NewHasher(authCfg.BcryptCost)
	authSvc := auth.New(userStore, refreshStore, authHasher, authSigner)
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
	expSvc := expiry.New(devMgr, deviceStore, profileStore, txStore, log)
	if err := expSvc.Start(rootCtx); err != nil {
		log.WithError(err).Fatal("start expiry service")
	}

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
	devMgr.OnDeviceRemoved = func(slug string) {
		expSvc.StopDevice(slug)
		if metricsSvc != nil {
			metricsSvc.StopDevice(slug)
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

	// ── HTTP Server ───────────────────────────────────────────────────────
	deps := &api.Deps{
		Logger:       log,
		HTTPConfig:   httpCfg,
		DB:           db,
		DeviceStore:  deviceStore,
		TxStore:      txStore,
		ProfileStore: profileStore,
		AuthService:  authSvc,
		AuthSigner:   authSigner,
		UserLimiter:  userLim,
		IPLimiter:    ipLim,
		HeavyLimiter: heavyLim,
		DevMgr:       devMgr,
		Hub:          hub,
		InfluxReader: influxReader,
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
