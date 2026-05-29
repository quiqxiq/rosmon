package expiry

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/quiqxiq/rosmon/mikrotik/hotspot"
	"github.com/quiqxiq/rosmon/service/devmgr"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/quiqxiq/rosmon/workflows"
	"github.com/sirupsen/logrus"
)

// Backoff parameters saat device disconnect. Mulai dari interval normal,
// gandakan di tiap iterasi gagal, cap di backoffMax. Reset ke normal saat
// device kembali tersambung.
const (
	backoffInitial = 30 * time.Second
	backoffMax     = 10 * time.Minute
	backoffFactor  = 2
)

// Service menjalankan satu goroutine checker per device yang memeriksa
// expiry user berdasarkan comment field (format mikhmon).
type Service struct {
	devMgr   *devmgr.Manager
	devices  store.DeviceStore
	profiles store.HotspotProfileStore
	txStore  store.TransactionStore
	log      *logrus.Logger

	mu      sync.Mutex
	cancels map[uint]context.CancelFunc // key = device ID
	rootCtx context.Context
}

func New(
	mgr *devmgr.Manager,
	devices store.DeviceStore,
	profiles store.HotspotProfileStore,
	txStore store.TransactionStore,
	log *logrus.Logger,
) *Service {
	return &Service{
		devMgr:   mgr,
		devices:  devices,
		profiles: profiles,
		txStore:  txStore,
		log:      log,
		cancels:  make(map[uint]context.CancelFunc),
	}
}

// Start menjalankan per-device goroutine checker. Non-blocking; semua goroutine
// dihentikan saat ctx dibatalkan.
func (s *Service) Start(ctx context.Context) error {
	s.rootCtx = ctx
	devs, err := s.devices.List(ctx)
	if err != nil {
		return err
	}
	s.mu.Lock()
	for _, d := range devs {
		s.startLocked(d)
	}
	s.mu.Unlock()
	return nil
}

// StartDevice menambah checker untuk device baru yang ditambah setelah Start().
// Idempotent — jika checker sudah jalan, tidak membuat duplikat.
func (s *Service) StartDevice(d model.MikrotikDevice) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.cancels[d.ID]; exists {
		return
	}
	s.startLocked(d)
}

// StopDevice menghentikan checker untuk device yang dihapus.
func (s *Service) StopDevice(deviceID uint) {
	s.mu.Lock()
	cancel, ok := s.cancels[deviceID]
	delete(s.cancels, deviceID)
	s.mu.Unlock()
	if ok {
		cancel()
	}
}

func (s *Service) startLocked(d model.MikrotikDevice) {
	ctx, cancel := context.WithCancel(s.rootCtx)
	s.cancels[d.ID] = cancel
	go s.runChecker(ctx, d)
}

// runChecker adalah loop expiry checker untuk satu device dengan
// state machine sederhana untuk handle device disconnect:
//
//   - stateActive: tick di interval normal (default 2m). Setiap tick
//     panggil checkDevice; kalau gagal dengan ErrDeviceNotConnected,
//     transisi ke stateBackoff dan log SEKALI.
//   - stateBackoff: tick di interval backoff (start 30s, ×2 per gagal,
//     cap 10m). Saat checkDevice sukses, log "device recovered",
//     reset backoff, kembali ke stateActive.
//
// Tujuan: kurangi log spam dan load ke device manager saat router down
// dalam waktu lama.
func (s *Service) runChecker(ctx context.Context, d model.MikrotikDevice) {
	normalInterval, err := time.ParseDuration(d.ExpiryCheckInterval)
	if err != nil || normalInterval <= 0 {
		normalInterval = 2 * time.Minute
	}

	log := s.log.WithField("device", d.DisplayName)
	log.Info("expiry: checker started")

	var (
		backoff      = time.Duration(0)
		inBackoff    = false
		currInterval = normalInterval
	)
	timer := time.NewTimer(currInterval)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			// Re-fetch device state so timezone updates (from devmgr on reconnect)
			// are picked up without restarting the goroutine.
			if fresh, ferr := s.devices.Get(ctx, d.ID); ferr == nil {
				d = fresh
				if ni, nerr := time.ParseDuration(d.ExpiryCheckInterval); nerr == nil && ni > 0 {
					normalInterval = ni
				}
			}
			err := s.checkDevice(ctx, d)
			switch {
			case errors.Is(err, devmgr.ErrDeviceNotConnected):
				if !inBackoff {
					log.Info("expiry: device disconnected, switching to backoff")
					inBackoff = true
					backoff = backoffInitial
				} else if backoff < backoffMax {
					backoff = time.Duration(int64(backoff) * backoffFactor)
					if backoff > backoffMax {
						backoff = backoffMax
					}
				}
				currInterval = backoff
			case err != nil:
				log.WithError(err).Warn("expiry: check failed")
				currInterval = normalInterval
				inBackoff = false
				backoff = 0
			default:
				if inBackoff {
					log.Info("expiry: device recovered, back to normal interval")
				}
				currInterval = normalInterval
				inBackoff = false
				backoff = 0
			}
			timer.Reset(currInterval)
		}
	}
}

// checkDevice memeriksa semua user di satu device dan mengeksekusi aksi expired.
func (s *Service) checkDevice(ctx context.Context, d model.MikrotikDevice) error {
	// Resolve timezone router — diisi oleh devmgr saat connect. Fallback UTC.
	loc := time.UTC
	if d.TimeZone != "" {
		if l, err := time.LoadLocation(d.TimeZone); err == nil {
			loc = l
		} else {
			s.log.WithField("tz", d.TimeZone).Warn("expiry: invalid timezone, fallback UTC")
		}
	}

	cs, err := s.devMgr.Get(d.ID)
	if err != nil {
		return err
	}

	users, err := cs.Hot.UserList(ctx)
	if err != nil {
		return fmt.Errorf("userlist: %w", err)
	}

	now := time.Now()
	for _, u := range users {
		expiry, ok := ParseExpiry(u.Comment, loc)
		if !ok {
			continue
		}
		if now.Before(expiry) {
			continue
		}

		// User expired — ambil konfigurasi mode dari DB. Kalau belum dikonfigurasi,
		// skip supaya tidak ada tindakan tanpa sepengetahuan operator.
		cfg, err := s.profiles.GetByName(ctx, d.ID, u.Profile)
		if err != nil {
			if errors.Is(err, store.ErrHotspotProfileNotFound) {
				continue
			}
			s.log.WithError(err).Warnf("expiry: cannot get profile config for %s", u.Profile)
			continue
		}

		if err := s.executeExpiry(ctx, cs, d, u.ID, u.Name, u.Profile, u.MACAddress, cfg); err != nil {
			s.log.WithError(err).Warnf("expiry: action failed for user %s", u.Name)
		}
	}
	return nil
}

// executeExpiry menjalankan aksi expiry sesuai mode di config.
func (s *Service) executeExpiry(
	ctx context.Context,
	cs *devmgr.ClientSet,
	d model.MikrotikDevice,
	userID, userName, profile, mac string,
	cfg model.HotspotProfile,
) error {
	switch cfg.ExpiryMode {
	case "0":
		return nil

	case "rem", "remc":
		if err := workflows.DeleteUser(ctx, cs.WF, userID); err != nil {
			return err
		}

	case "ntf", "ntfc":
		// Set limit-uptime first so user cannot re-authenticate
		if err := cs.Hot.UserSet(ctx, hotspot.UserSetArgs{
			ID:          userID,
			LimitUptime: "1s",
		}); err != nil {
			return err
		}
		// Kick any active sessions (best-effort — don't fail on error)
		if actives, aerr := cs.Hot.ActiveList(ctx); aerr == nil {
			for _, a := range actives {
				if a.User == userName {
					_ = cs.Hot.ActiveRemove(ctx, a.ID)
				}
			}
		}

	default:
		return nil
	}

	return nil
}
