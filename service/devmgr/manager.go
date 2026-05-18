package devmgr

import (
	"context"
	"crypto/tls"
	"errors"
	"net"
	"os"
	"sync"
	"time"

	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/roslib-mikhmon/mikrotik/hotspot"
	"github.com/quiqxiq/roslib-mikhmon/mikrotik/network"
	"github.com/quiqxiq/roslib-mikhmon/mikrotik/ppp"
	"github.com/quiqxiq/roslib-mikhmon/mikrotik/syslog"
	"github.com/quiqxiq/roslib-mikhmon/mikrotik/system"
	"github.com/quiqxiq/roslib-mikhmon/store"
	"github.com/quiqxiq/roslib-mikhmon/store/model"
	"github.com/quiqxiq/roslib-mikhmon/workflows"
	"github.com/sirupsen/logrus"
)

// ErrDeviceNotConnected dikembalikan oleh Get saat device tidak ditemukan
// di active map (belum sempat connect, atau sudah di-disconnect oleh
// supervisor karena auth/network error). Sentinel ini di-export agar
// caller (mis. expiry service) dapat detect via errors.Is dan apply
// backoff sebelum retry.
var ErrDeviceNotConnected = errors.New("devmgr: device not connected")

// ClientSet adalah kumpulan klien yang sudah terikat ke satu roslib.Device.
type ClientSet struct {
	DeviceID uint
	Dev      *roslib.Device
	Hot      *hotspot.Client
	Sys      *system.Client
	Net      *network.Client
	PPP      *ppp.Client
	Log      *syslog.Client
	WF       *workflows.Clients
}

// Manager memuat device dari DB, mengelola koneksi, dan memperbarui status.
type Manager struct {
	store  store.DeviceStore
	log    *logrus.Logger
	mu     sync.RWMutex
	active map[string]*ClientSet // key = device slug
	ctx    context.Context       // root context, hidup sepanjang server

	// Hook callbacks — dipanggil setelah koneksi berhasil / device dihapus.
	// Set sebelum memanggil Start(). Thread-safe: hanya dibaca setelah Set.
	OnDeviceConnected func(d model.MikrotikDevice)
	OnDeviceRemoved   func(slug string)
}

func New(ds store.DeviceStore, log *logrus.Logger) *Manager {
	return &Manager{
		store:  ds,
		log:    log,
		active: make(map[string]*ClientSet),
	}
}

// Start memuat semua active device dari DB, mendial koneksi, lalu menjalankan
// loop status update tiap 30 detik di background.
func (m *Manager) Start(ctx context.Context) error {
	m.ctx = ctx
	devices, err := m.store.List(ctx)
	if err != nil {
		return err
	}
	for _, d := range devices {
		if err := m.connect(d); err != nil {
			m.log.WithError(err).Warnf("devmgr: failed to connect %s", d.Slug)
		}
	}
	return nil
}

// Get mengembalikan ClientSet by slug. Mengembalikan ErrDeviceNotConnected
// (sentinel) kalau tidak ditemukan — caller dapat detect via errors.Is.
func (m *Manager) Get(slug string) (*ClientSet, error) {
	m.mu.RLock()
	cs, ok := m.active[slug]
	m.mu.RUnlock()
	if !ok {
		return nil, ErrDeviceNotConnected
	}
	return cs, nil
}

// ListActive mengembalikan snapshot slug→ClientSet untuk semua device yang sedang terhubung.
func (m *Manager) ListActive() map[string]*ClientSet {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make(map[string]*ClientSet, len(m.active))
	for k, v := range m.active {
		out[k] = v
	}
	return out
}

// Add mendaftarkan device baru (dipanggil setelah POST /devices).
// Pakai m.ctx (root context) bukan request context — koneksi harus hidup
// sepanjang server, bukan hanya selama HTTP request.
func (m *Manager) Add(_ context.Context, d model.MikrotikDevice) error {
	return m.connect(d)
}

// Remove mendiskoneksi device dan menghapusnya dari map.
// Async — supervisor goroutine roslib mungkin masih running sesaat
// setelah return; pakai RemoveAndWait kalau caller perlu re-dial slug
// yang sama segera setelah ini.
func (m *Manager) Remove(slug string) {
	m.removeInternal(slug, false)
}

// RemoveAndWait mendiskoneksi device dan menunggu supervisor goroutine
// roslib benar-benar berhenti (lihat roslib.Device.CloseAndWait) sebelum
// return. Dipakai oleh Devices.Update agar re-dial slug yang sama tidak
// race dengan supervisor lama yang masih emit OnStatusChange.
func (m *Manager) RemoveAndWait(slug string) {
	m.removeInternal(slug, true)
}

func (m *Manager) removeInternal(slug string, wait bool) {
	m.mu.Lock()
	cs, ok := m.active[slug]
	if ok {
		delete(m.active, slug)
	}
	m.mu.Unlock()

	if !ok {
		return
	}
	if m.OnDeviceRemoved != nil {
		m.OnDeviceRemoved(slug)
	}
	if wait {
		cs.Dev.CloseAndWait()
	} else {
		cs.Dev.Close()
	}
}

// connect mendial roslib.Device dan membuat ClientSet.
// Selalu pakai m.ctx agar koneksi hidup sepanjang server.
//
// UseTLS=true dari model akan diterjemahkan ke roslib.Options.TLS dengan
// ServerName diturunkan dari host di Address. InsecureSkipVerify
// di-toggle via env DEVICE_TLS_INSECURE=true (untuk router dengan
// self-signed cert). Default strict TLS 1.2+.
func (m *Manager) connect(d model.MikrotikDevice) error {
	opts := roslib.Options{
		Address:        d.Address,
		Username:       d.Username,
		Password:       d.Password,
		Logger:         m.log,
		OnStatusChange: m.makeStatusHook(d),
	}
	if d.UseTLS {
		opts.TLS = buildTLSConfig(d.Address)
	}
	dev, err := roslib.New(m.ctx, opts)
	if err != nil {
		now := time.Now()
		m.persistStatus(d.ID, "error", err.Error(), &now)
		return err
	}

	cs := &ClientSet{
		DeviceID: d.ID,
		Dev:      dev,
		Hot:      hotspot.New(dev),
		Sys:      system.New(dev),
		Net:      network.New(dev),
		PPP:      ppp.New(dev),
		Log:      syslog.New(dev),
	}
	cs.WF = workflows.New(dev)

	m.mu.Lock()
	m.active[d.Slug] = cs
	m.mu.Unlock()

	now := time.Now()
	m.persistStatus(d.ID, "connected", "", &now)

	if m.OnDeviceConnected != nil {
		m.OnDeviceConnected(d)
	}
	return nil
}

// makeStatusHook mengembalikan callback OnStatusChange yang update DB
// secara real-time setiap kali supervisor mendeteksi perubahan koneksi.
//
// Catatan: hook ini dipanggil dari supervisor goroutine roslib yang
// hidup sepanjang Device.Close() belum dipanggil. Saat server shutdown,
// m.ctx ke-cancel sebelum supervisor sempat emit status "closed"; jadi
// kita pakai context.Background() dengan timeout pendek (statusCtx)
// supaya status terminal tetap ter-persist meskipun root ctx sudah
// canceled. Kalau DB juga down, write akan timeout & di-skip.
func (m *Manager) makeStatusHook(d model.MikrotikDevice) func(string, string) {
	dbStatus := map[string]string{
		"connected": "connected",
		"error":     "error",
		"closed":    "disconnected",
	}
	log := m.log.WithField("device", d.Slug)
	return func(status, errMsg string) {
		s, ok := dbStatus[status]
		if !ok {
			s = status
		}
		now := time.Now()
		m.persistStatus(d.ID, s, errMsg, &now)
		log.WithField("status", s).Info("devmgr: device status changed")
	}
}

// persistStatus menulis status device ke DB dengan context.Background +
// timeout 3s — sengaja TIDAK turunan m.ctx supaya server shutdown tidak
// menyebabkan status terminal silently di-drop. Kalau DB juga down,
// write akan timeout & di-skip (best-effort).
func (m *Manager) persistStatus(id uint, status, errMsg string, lastSeen *time.Time) {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := m.store.UpdateStatus(ctx, id, status, errMsg, lastSeen); err != nil {
		m.log.WithError(err).WithField("status", status).Warn("devmgr: persistStatus failed")
	}
}

// buildTLSConfig membangun *tls.Config untuk dial RouterOS API-SSL.
// ServerName diturunkan dari host di "host:port". InsecureSkipVerify
// di-toggle via env DEVICE_TLS_INSECURE=true (router self-signed cert).
func buildTLSConfig(address string) *tls.Config {
	host := address
	if h, _, err := net.SplitHostPort(address); err == nil {
		host = h
	}
	cfg := &tls.Config{
		ServerName: host,
		MinVersion: tls.VersionTLS12,
	}
	if os.Getenv("DEVICE_TLS_INSECURE") == "true" {
		cfg.InsecureSkipVerify = true // gosec G402 — opt-in via env
	}
	return cfg
}
