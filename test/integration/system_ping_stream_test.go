//go:build integration

package integration

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/mikrotik/system"
	"github.com/stretchr/testify/require"
)

// TestIntegration_PingCount menguji /ping dengan count — inherently finite
// stream yang emit !re tiap reply lalu !done saat count tercapai.
func TestIntegration_PingCount(t *testing.T) {
	c := testutil.NewClient(t)
	sys := system.New(c)

	const id = "it-ping-count"
	var (
		got  atomic.Int32
		done = make(chan struct{})
		once sync.Once
	)

	err := sys.PingCount(id, "8.8.8.8", 4,
		func(s *roslib.Sentence) {
			if s.Word() == "!re" {
				got.Add(1)
				t.Logf("ping count #%d: seq=%s time=%s status=%s",
					got.Load(), s.Get("seq"), s.Get("time"), s.Get("status"))
			}
		},
		func(_ string, err error) {
			once.Do(func() {
				if err != nil {
					t.Logf("ping count onFinish error: %v", err)
				} else {
					t.Logf("ping count finished naturally")
				}
				close(done)
			})
		},
	)
	require.NoError(t, err)

	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatal("timeout waiting for ping count to finish")
	}

	require.GreaterOrEqual(t, got.Load(), int32(1), "minimal 1 reply diterima")
	t.Logf("ping count total replies: %d", got.Load())
}

// TestIntegration_PingStream menguji /ping tanpa count — inherent infinite
// stream yang tidak pernah mengembalikan !done. Harus di-stop manual.
func TestIntegration_PingStream(t *testing.T) {
	c := testutil.NewClient(t)
	sys := system.New(c)

	const id = "it-ping-stream"
	var got atomic.Int32

	err := sys.PingStream(id, "8.8.8.8", func(s *roslib.Sentence) {
		if s.Word() == "!re" {
			got.Add(1)
			if got.Load() <= 3 {
				t.Logf("ping stream #%d: seq=%s time=%s status=%s",
					got.Load(), s.Get("seq"), s.Get("time"), s.Get("status"))
			}
		}
	})
	require.NoError(t, err)

	require.Eventually(t, func() bool { return got.Load() >= 2 }, 5*time.Second, 200*time.Millisecond,
		"minimal 2 reply dalam 5s")

	t.Logf("ping stream received %d replies before stop", got.Load())

	stopped := sys.StopPingStream(id)
	require.True(t, stopped, "StopPingStream harus return true (stream ditemukan)")

	time.Sleep(200 * time.Millisecond)
}

// TestIntegration_PingStream_SecondRegisterAfterStop memverifikasi bahwa
// setelah StopPingStream, ID yang sama bisa di-register ulang tanpa error.
func TestIntegration_PingStream_SecondRegisterAfterStop(t *testing.T) {
	c := testutil.NewClient(t)
	sys := system.New(c)

	const id = "it-ping-reuse"

	// Round 1
	var got1 atomic.Int32
	err := sys.PingStream(id, "8.8.8.8", func(s *roslib.Sentence) {
		if s.Word() == "!re" {
			got1.Add(1)
		}
	})
	require.NoError(t, err)
	require.Eventually(t, func() bool { return got1.Load() >= 1 }, 5*time.Second, 200*time.Millisecond)
	t.Logf("round 1: got %d replies", got1.Load())
	require.True(t, sys.StopPingStream(id))
	time.Sleep(200 * time.Millisecond)

	// Round 2 — ID yang sama harus bisa dipakai lagi.
	var got2 atomic.Int32
	err = sys.PingStream(id, "8.8.8.8", func(s *roslib.Sentence) {
		if s.Word() == "!re" {
			got2.Add(1)
		}
	})
	require.NoError(t, err, "register ulang dengan ID sama setelah stop harus sukses")
	require.Eventually(t, func() bool { return got2.Load() >= 1 }, 5*time.Second, 200*time.Millisecond)
	t.Logf("round 2: got %d replies", got2.Load())
	require.True(t, sys.StopPingStream(id))
}

// TestIntegration_PingStream_LocalAddress memverifikasi ping ke alamat lokal
// router (192.168.233.1) juga berfungsi.
func TestIntegration_PingStream_LocalAddress(t *testing.T) {
	c := testutil.NewClient(t)
	sys := system.New(c)

	const id = "it-ping-local"
	var got atomic.Int32

	err := sys.PingStream(id, "192.168.233.1", func(s *roslib.Sentence) {
		if s.Word() == "!re" {
			got.Add(1)
			t.Logf("ping local #%d: seq=%s time=%s status=%s",
				got.Load(), s.Get("seq"), s.Get("time"), s.Get("status"))
		}
	})
	require.NoError(t, err)

	require.Eventually(t, func() bool { return got.Load() >= 2 }, 5*time.Second, 200*time.Millisecond,
		"minimal 2 reply dalam 5s")

	t.Logf("ping local received %d replies", got.Load())
	require.True(t, sys.StopPingStream(id))
}
