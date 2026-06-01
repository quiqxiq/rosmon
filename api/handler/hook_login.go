package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/domain"
	"github.com/quiqxiq/rosmon/internal/rosfmt"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// LoginEventComment adalah marker Comment di tabel transactions yang
// menandai record dibuat dari webhook login event (bukan dari expiry
// service). Dipakai juga untuk dedup re-login.
const LoginEventComment = "login"

// HookLogin meng-handle webhook fire-and-forget dari MikroTik on-login
// script. Endpoint ini TIDAK pakai JWT auth (router tidak bisa pegang
// token). Keamanan via HOOK_SHARED_SECRET env — kalau di-set, setiap
// request harus menyertakan header X-Rosmon-Secret dengan nilai yang cocok.
//
// Flow:
//  1. Validasi shared secret (jika dikonfigurasi).
//  2. Parse form-encoded body: user, mac, ip, profile.
//  3. Validate device_id exists.
//  4. Lookup profile_config (device_id, profile).
//  5. Skip kalau mode tidak mencatat transaksi (rem/ntf/"0") → non_recording_mode.
//  6. Dedup window-based: kalau sudah ada record (device_id, username, comment="login")
//     dalam window validity terakhir → return 200 tanpa insert (re-login).
//  7. Insert transaction baru → return 200.
type HookLogin struct {
	DeviceStore      store.DeviceStore
	TxStore          store.TransactionStore
	ProfileStore     store.HotspotProfileStore
	HookSharedSecret string // opsional — jika di-set, validasi X-Rosmon-Secret header
	Log              *logrus.Logger
}

// NewHookLogin constructor.
func NewHookLogin(
	devStore store.DeviceStore,
	txStore store.TransactionStore,
	profStore store.HotspotProfileStore,
	hookSecret string,
	log *logrus.Logger,
) *HookLogin {
	if log == nil {
		log = logrus.New()
	}
	return &HookLogin{
		DeviceStore:      devStore,
		TxStore:          txStore,
		ProfileStore:     profStore,
		HookSharedSecret: hookSecret,
		Log:              log,
	}
}

// Register mount /hook/hotspot/login/:device_id ke group `g`. Group ini
// HARUS tidak pakai auth chain (lihat routes.go).
func (h *HookLogin) Register(g *gin.RouterGroup) {
	g.POST("/hook/hotspot/login/:device_id", h.Login)
}

// Login handler webhook. Selalu return 200 OK untuk error non-fatal —
// router tidak punya cara retry yang bermakna, dan kita tidak ingin
// /tool/fetch on-error= memicu loop atau leak ke log router.
//
// Fatal hanya untuk request yang malformed (bad device_id, missing user).
func (h *HookLogin) Login(c *gin.Context) {
	// Validasi shared secret jika dikonfigurasi.
	if h.HookSharedSecret != "" {
		header := c.GetHeader("X-Rosmon-Secret")
		if header != h.HookSharedSecret {
			c.AbortWithStatusJSON(http.StatusUnauthorized,
				dto.Err("UNAUTHORIZED", "invalid hook secret", c.Request.URL.Path))
			return
		}
	}
	deviceIDRaw := c.Param("device_id")
	deviceID64, err := strconv.ParseUint(deviceIDRaw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ID", "invalid device id", c.Request.URL.Path))
		return
	}
	deviceID := uint(deviceID64)

	user := strings.TrimSpace(c.PostForm("user"))
	if user == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("VALIDATION", "missing user", c.Request.URL.Path))
		return
	}
	// Defensive cap supaya tidak ada DB OOM dari spoofed payload.
	if len(user) > 128 {
		user = user[:128]
	}
	mac := truncate(strings.TrimSpace(c.PostForm("mac")), 17)
	ip := truncate(strings.TrimSpace(c.PostForm("ip")), 45)
	profile := truncate(strings.TrimSpace(c.PostForm("profile")), 64)

	logger := h.Log.WithFields(logrus.Fields{
		"device_id": deviceID,
		"user":      user,
		"profile":   profile,
	})

	// Validate device exists. Kalau tidak ada → 404 (script salah konfigurasi).
	if _, err := h.DeviceStore.Get(c.Request.Context(), deviceID); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("DEVICE_NOT_FOUND", "device not found", c.Request.URL.Path))
			return
		}
		logger.WithError(err).Error("hook/login: device store error")
		c.AbortWithStatusJSON(http.StatusInternalServerError,
			dto.Err("INTERNAL", "device lookup failed", c.Request.URL.Path))
		return
	}

	// Profile harus ada di payload — webhook handler tidak query RouterOS.
	if profile == "" {
		logger.Warn("hook/login: missing profile in payload, skip recording")
		c.JSON(http.StatusOK, dto.OK(map[string]any{"recorded": false, "reason": "missing_profile"}))
		return
	}

	// Lookup profile_config. Pakai Get (yang punya default fallback) —
	// kalau profile belum di-sync ke DB, kita dapat default mode "rem"
	// dengan price 0. Untuk MVP, kita treat as "no recording" supaya
	// tidak record sale dengan price=0.
	cfg, err := h.ProfileStore.GetByName(c.Request.Context(), deviceID, profile)
	if err != nil {
		if errors.Is(err, store.ErrHotspotProfileNotFound) {
			logger.Info("hook/login: profile config not found, skip recording (run sync first)")
			c.JSON(http.StatusOK, dto.OK(map[string]any{
				"recorded": false,
				"reason":   "profile_not_configured",
			}))
			return
		}
		logger.WithError(err).Error("hook/login: profile config store error")
		c.AbortWithStatusJSON(http.StatusInternalServerError,
			dto.Err("INTERNAL", "profile config lookup failed", c.Request.URL.Path))
		return
	}

	// Hanya mode "remc" dan "ntfc" yang mencatat penjualan. Mode "0", "rem",
	// "ntf" tidak punya suffix "c" → skip tanpa record.
	mode, modeErr := domain.ParseExpiredMode(cfg.ExpiryMode)
	if modeErr != nil || !mode.RecordsTransaction() {
		c.JSON(http.StatusOK, dto.OK(map[string]any{"recorded": false, "reason": "non_recording_mode"}))
		return
	}

	// Dedup berbasis window validity: re-login dalam window validity yang sama
	// (mis. user reconnect dalam 1 hari) tidak ter-record ganda. Login setelah
	// window habis (pembelian baru) tetap ter-record.
	dur, durErr := rosfmt.ParseDuration(cfg.Validity)
	if durErr != nil || dur == 0 {
		dur = 24 * time.Hour // safe default kalau validity tidak di-set
	}
	exists, err := h.TxStore.ExistsByUserCommentSince(c.Request.Context(),
		deviceID, user, LoginEventComment, time.Now().Add(-dur))
	if err != nil {
		logger.WithError(err).Error("hook/login: dedup check failed")
		c.AbortWithStatusJSON(http.StatusInternalServerError,
			dto.Err("INTERNAL", "dedup check failed", c.Request.URL.Path))
		return
	}
	if exists {
		c.JSON(http.StatusOK, dto.OK(map[string]any{"recorded": false, "reason": "already_recorded"}))
		return
	}

	// Insert transaction baru.
	now := time.Now()
	tx := &model.Transaction{
		DeviceID:  deviceID,
		SaleDate:  strings.ToLower(now.Format("Jan/02/2006")),
		SaleTime:  now.Format("15:04:05"),
		SaleMonth: strings.ToLower(now.Format("Jan2006")),
		Username:  user,
		Price:     cfg.Price,
		SellPrice: cfg.SellPrice,
		IP:        ip,
		MAC:       mac,
		Validity:  cfg.Validity,
		Profile:   profile,
		Comment:   LoginEventComment,
	}
	if err := h.TxStore.Create(c.Request.Context(), tx); err != nil {
		logger.WithError(err).Error("hook/login: insert transaction failed")
		c.AbortWithStatusJSON(http.StatusInternalServerError,
			dto.Err("INTERNAL", "insert transaction failed", c.Request.URL.Path))
		return
	}
	logger.Info("hook/login: selling recorded")
	c.JSON(http.StatusOK, dto.OK(map[string]any{
		"recorded":      true,
		"transaction_id": tx.ID,
	}))
}

// truncate cap string ke maxLen byte. Defensive vs payload spoofing yang
// bisa overflow column size (mac varchar(17), ip varchar(45), dst).
func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen]
}
