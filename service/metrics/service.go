// Package metrics mengumpulkan data RouterOS ke InfluxDB3 menggunakan stream
// native RouterOS (interval= dan follow) — bukan Go-side ticker.
// Satu set stream per device; lifecycle dikelola via StartDevice/StopDevice
// yang dipanggil dari devmgr hooks.
package metrics

import (
	"context"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/InfluxCommunity/influxdb3-go/v2/influxdb3"
	roslibinflux "github.com/quiqxiq/roslib/metrics/influx"
	"github.com/quiqxiq/rosmon/service/devmgr"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"

	"github.com/quiqxiq/roslib"
)

// Service mengumpulkan metrics dari semua device yang terhubung ke InfluxDB3.
type Service struct {
	cli    *influxdb3.Client
	devMgr *devmgr.Manager
	log    *logrus.Logger

	mu      sync.Mutex
	cancels map[uint]context.CancelFunc
	rootCtx context.Context
}

func New(cli *influxdb3.Client, mgr *devmgr.Manager, log *logrus.Logger) *Service {
	return &Service{
		cli:     cli,
		devMgr:  mgr,
		log:     log,
		cancels: make(map[uint]context.CancelFunc),
	}
}

// Start memulai collection untuk semua device yang sudah terhubung.
func (s *Service) Start(ctx context.Context) {
	s.rootCtx = ctx
	s.mu.Lock()
	defer s.mu.Unlock()
	for deviceID, cs := range s.devMgr.ListActive() {
		s.startLocked(deviceID, cs)
	}
}

// StartDevice memulai collection untuk device baru. Idempotent.
func (s *Service) StartDevice(d model.MikrotikDevice) {
	cs, err := s.devMgr.Get(d.ID)
	if err != nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.cancels[d.ID]; exists {
		return
	}
	s.startLocked(d.ID, cs)
}

// StopDevice menghentikan collection untuk device yang dihapus.
func (s *Service) StopDevice(deviceID uint) {
	s.mu.Lock()
	cancel, ok := s.cancels[deviceID]
	delete(s.cancels, deviceID)
	s.mu.Unlock()
	if ok {
		cancel()
	}
}

// startedStream menyimpan ID dan cleanup function untuk satu stream
// yang berhasil di-register. Dipakai supaya cleanup goroutine hanya
// panggil Stop* untuk stream yang benar-benar running (cegah no-op
// log noise dari stream yang gagal di-start).
type startedStream struct {
	id   string
	stop func()
}

func (s *Service) startLocked(deviceID uint, cs *devmgr.ClientSet) {
	ctx, cancel := context.WithCancel(s.rootCtx)
	s.cancels[deviceID] = cancel
	devStr := strconv.FormatUint(uint64(deviceID), 10)
	log := s.log.WithField("device", devStr)

	var started []startedStream
	track := func(id string, err error, stopFn func()) {
		if err != nil {
			log.WithError(err).WithField("stream", id).Warn("metrics: stream start failed")
			return
		}
		started = append(started, startedStream{id: id, stop: stopFn})
	}

	// ── system_resource — system resource print interval=5s ──────────────
	resW := roslibinflux.NewWriter(s.cli, "system_resource",
		fixedTags(deviceID),
		func(sen *roslib.Sentence) map[string]any {
			return map[string]any{
				"cpu_load":     sen.IntOr("cpu-load", 0),
				"free_memory":  sen.IntOr("free-memory", 0),
				"total_memory": sen.IntOr("total-memory", 0),
				"free_hdd":     sen.IntOr("free-hdd-space", 0),
			}
		},
	)
	resID := "metrics:" + devStr + ":resource"
	track(resID,
		cs.Sys.MonitorResource(resID, 5*time.Second, roslibinflux.PollSink(resW, log)),
		func() { cs.Sys.StopMonitor(resID) },
	)

	// interface_stats + queue_stats kini ditulis oleh service/netstream
	// (sumber tunggal stream → live SSE + Influx), bukan di sini.

	// ── hotspot_user_bytes — ip/hotspot/user/print bytes interval=10s ────
	ubW := roslibinflux.NewWriter(s.cli, "hotspot_user_bytes",
		func(sen *roslib.Sentence) map[string]string {
			return map[string]string{"device": devStr, "user": sen.Get("name")}
		},
		func(sen *roslib.Sentence) map[string]any {
			return map[string]any{
				"bytes_in":  sen.IntOr("bytes-in", 0),
				"bytes_out": sen.IntOr("bytes-out", 0),
			}
		},
	)
	ubID := "metrics:" + devStr + ":user-bytes"
	ubSink := roslibinflux.StreamSink(ubW, log)
	track(ubID,
		cs.Hot.UserBytesStream(ubID, 10*time.Second, func(sen *roslib.Sentence) {
			if sen.Word() == "!re" {
				ubSink(sen)
			}
		}),
		func() { cs.Hot.StopUserStream(ubID) },
	)

	// ── hotspot_user_packets — ip/hotspot/user/print packets interval=10s ─
	upW := roslibinflux.NewWriter(s.cli, "hotspot_user_packets",
		func(sen *roslib.Sentence) map[string]string {
			return map[string]string{"device": devStr, "user": sen.Get("name")}
		},
		func(sen *roslib.Sentence) map[string]any {
			return map[string]any{
				"packets_in":  sen.IntOr("packets-in", 0),
				"packets_out": sen.IntOr("packets-out", 0),
			}
		},
	)
	upID := "metrics:" + devStr + ":user-packets"
	upSink := roslibinflux.StreamSink(upW, log)
	track(upID,
		cs.Hot.UserPacketsStream(upID, 10*time.Second, func(sen *roslib.Sentence) {
			if sen.Word() == "!re" {
				upSink(sen)
			}
		}),
		func() { cs.Hot.StopUserStream(upID) },
	)

	// ── hotspot_active — ip/hotspot/active/print follow ──────────────────
	// Simpan setiap event connect/disconnect dengan field dead=true/false.
	haW := roslibinflux.NewWriter(s.cli, "hotspot_active",
		func(sen *roslib.Sentence) map[string]string {
			return map[string]string{
				"device": devStr,
				"user":   sen.Get("user"),
				"server": sen.Get("server"),
			}
		},
		func(sen *roslib.Sentence) map[string]any {
			return map[string]any{
				"bytes_in":  sen.IntOr("bytes-in", 0),
				"bytes_out": sen.IntOr("bytes-out", 0),
				"dead":      sen.Get(".dead") == "true",
			}
		},
	)
	haID := "metrics:" + devStr + ":hotspot-active"
	haSink := roslibinflux.StreamSink(haW, log)
	track(haID,
		cs.Hot.ActiveStream(haID, func(sen *roslib.Sentence) {
			if sen.Word() == "!re" {
				haSink(sen)
			}
		}),
		func() { cs.Hot.StopActiveStream(haID) },
	)

	// ── ppp_active — ppp/active/print follow ─────────────────────────────
	pppW := roslibinflux.NewWriter(s.cli, "ppp_active",
		func(sen *roslib.Sentence) map[string]string {
			return map[string]string{
				"device":  devStr,
				"name":    sen.Get("name"),
				"service": sen.Get("service"),
			}
		},
		func(sen *roslib.Sentence) map[string]any {
			return map[string]any{
				"dead": sen.Get(".dead") == "true",
			}
		},
	)
	pppID := "metrics:" + devStr + ":ppp-active"
	pppSink := roslibinflux.StreamSink(pppW, log)
	track(pppID,
		cs.PPP.ActiveStream(pppID, func(sen *roslib.Sentence) {
			if sen.Word() == "!re" {
				pppSink(sen)
			}
		}),
		func() { cs.PPP.StopActiveStream(pppID) },
	)

	// Cleanup streams yang BERHASIL di-start saat device dihapus atau
	// server shutdown. Tidak panggil Stop untuk stream yang gagal start —
	// cegah log noise / panic dari handler yang tidak ter-register.
	go func() {
		<-ctx.Done()
		for _, ss := range started {
			ss.stop()
		}
	}()

	log.WithField("started", len(started)).Info("metrics: streams started")
}

// ── helpers ──────────────────────────────────────────────────────────────────

// fixedTags mengembalikan TagFn dengan satu tag device=deviceID.
func fixedTags(deviceID uint) roslibinflux.TagFn {
	devStr := strconv.FormatUint(uint64(deviceID), 10)
	return func(*roslib.Sentence) map[string]string {
		return map[string]string{"device": devStr}
	}
}

// splitInOut mem-parse field format RouterOS "in/out" (mis. "1024/2048") menjadi
// dua int64. Mengembalikan 0/0 jika format tidak sesuai.
func splitInOut(s string) (int64, int64) {
	parts := strings.SplitN(s, "/", 2)
	if len(parts) != 2 {
		return 0, 0
	}
	in, _ := strconv.ParseInt(strings.TrimSpace(parts[0]), 10, 64)
	out, _ := strconv.ParseInt(strings.TrimSpace(parts[1]), 10, 64)
	return in, out
}
