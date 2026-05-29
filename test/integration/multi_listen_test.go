//go:build integration

package integration

import (
	"sync/atomic"
	"testing"
	"time"

	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/mikrotik/network"
	"github.com/quiqxiq/rosmon/mikrotik/system"
	"github.com/stretchr/testify/require"
)

// TestIntegration_MultiListen_CancelOneDoesNotKillOthers memverifikasi bahwa
// membatalkan salah satu listener (ping) pada koneksi stream bersama tidak
// mematikan listener lain (hotspot active). Ini regression test untuk bug
// go-routeros v3.0.1: goroutine ListenArgsQueueContext memanggil c.r.Cancel()
// saat ctx.Done(), yang mematikan reader global.
func TestIntegration_MultiListen_CancelOneDoesNotKillOthers(t *testing.T) {
	c := testutil.NewClient(t)
	net := network.New(c)
	sys := system.New(c)

	const (
		idPing    = "it-multi-ping"
		idTraffic = "it-multi-traffic"
	)

	// Stream 1: /ping tanpa count (inherent infinite stream)
	var pingGot atomic.Int32
	err := sys.PingStream(idPing, "8.8.8.8", func(s *roslib.Sentence) {
		if s.Word() == "!re" {
			pingGot.Add(1)
			if pingGot.Load() <= 2 {
				t.Logf("ping: seq=%s time=%s", s.Get("seq"), s.Get("time"))
			}
		}
	})
	require.NoError(t, err)
	defer sys.StopPingStream(idPing)

	// Stream 2: /interface/monitor-traffic (emit ~1Hz, selalu ada data)
	var trafficGot atomic.Int32
	err = net.InterfaceTrafficStream(idTraffic, "ether1", func(s *roslib.Sentence) {
		trafficGot.Add(1)
		if trafficGot.Load() <= 2 {
			t.Logf("traffic: rx=%s tx=%s", s.Get("rx-bits-per-second"), s.Get("tx-bits-per-second"))
		}
	})
	require.NoError(t, err)
	defer net.StopStream(idTraffic)

	// Tunggu kedua stream produce data minimal 2x (biasanya < 3 detik).
	require.Eventually(t, func() bool { return pingGot.Load() >= 2 }, 5*time.Second, 200*time.Millisecond,
		"ping stream minimal 2 reply")
	require.Eventually(t, func() bool { return trafficGot.Load() >= 2 }, 5*time.Second, 200*time.Millisecond,
		"traffic stream minimal 2 sample")

	beforePing := pingGot.Load()
	beforeTraffic := trafficGot.Load()
	t.Logf("Before cancel: ping=%d traffic=%d", beforePing, beforeTraffic)

	// Cancel HANYA ping stream.
	require.True(t, sys.StopPingStream(idPing), "StopPingStream harus return true")
	t.Logf("Ping stream stopped")

	// Tunggu 2 detik — kalau bug masih ada, connStream mati, traffic stream juga mati.
	time.Sleep(2 * time.Second)

	afterTraffic := trafficGot.Load()
	t.Logf("After cancel (2s): ping=%d traffic=%d", pingGot.Load(), afterTraffic)

	// Traffic stream HARUS tetap menerima data.
	require.Greater(t, afterTraffic, beforeTraffic,
		"traffic stream harus tetap menerima sample setelah ping di-cancel — "+
		"jika tidak, berarti cancel satu listener mematikan semua listener di koneksi")

	// Cleanup
	net.StopStream(idTraffic)
}

// TestIntegration_TwoPings_CancelOne memverifikasi dua /ping infinite stream
// pada koneksi yang sama — cancel satu, yang lain harus tetap jalan.
func TestIntegration_TwoPings_CancelOne(t *testing.T) {
	c := testutil.NewClient(t)
	sys := system.New(c)

	const (
		idPing1 = "it-dual-ping-1"
		idPing2 = "it-dual-ping-2"
	)

	var got1, got2 atomic.Int32

	err := sys.PingStream(idPing1, "8.8.8.8", func(s *roslib.Sentence) {
		if s.Word() == "!re" {
			got1.Add(1)
		}
	})
	require.NoError(t, err)
	defer sys.StopPingStream(idPing1)

	err = sys.PingStream(idPing2, "192.168.233.1", func(s *roslib.Sentence) {
		if s.Word() == "!re" {
			got2.Add(1)
		}
	})
	require.NoError(t, err)
	defer sys.StopPingStream(idPing2)

	require.Eventually(t, func() bool { return got1.Load() >= 2 }, 5*time.Second, 200*time.Millisecond)
	require.Eventually(t, func() bool { return got2.Load() >= 2 }, 5*time.Second, 200*time.Millisecond)

	before := got2.Load()
	t.Logf("Before cancel ping1: ping1=%d ping2=%d", got1.Load(), before)

	// Cancel ping1
	require.True(t, sys.StopPingStream(idPing1))

	// Tunggu 3 detik — ping2 harus tetap jalan.
	time.Sleep(3 * time.Second)

	after := got2.Load()
	t.Logf("After cancel ping1 (3s): ping1=%d ping2=%d", got1.Load(), after)

	// Ping2 harus naik.
	require.Greater(t, after, before,
		"ping2 harus tetap menerima reply setelah ping1 di-cancel — "+
		"jika tidak, berarti cancel satu listener mematikan semua listener di koneksi")

	sys.StopPingStream(idPing2)
}
