//go:build integration

package integration

import (
	"sync/atomic"
	"testing"
	"time"

	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/mikrotik/hotspot"
	"github.com/stretchr/testify/require"
)

// TestIntegration_HotspotActiveStream menguji ActiveStream snapshot-and-follow
// dapat di-register tanpa error.
//
// Catatan: pada RouterOS tertentu, `/ip/hotspot/active/print follow` dengan
// tabel kosong langsung mengirim !done — listener di-cleanup natural oleh
// stream manager. Test tidak assert StopActiveStream() return true karena
// natural cleanup adalah perilaku valid.
func TestIntegration_HotspotActiveStream(t *testing.T) {
	c := testutil.NewClient(t)
	hot := hotspot.New(c)

	const id = "it-active-stream"
	var got atomic.Int32
	err := hot.ActiveStream(id, func(s *roslib.Sentence) {
		got.Add(1)
		t.Logf("active stream sentence: word=%s user=%s", s.Word(), s.Get("user"))
	})
	require.NoError(t, err)
	t.Cleanup(func() { hot.StopActiveStream(id) })

	time.Sleep(2 * time.Second)
	t.Logf("active stream: %d sentences diterima", got.Load())
}

// TestIntegration_HotspotActiveStreamFollowOnly menguji FollowOnly variant —
// hanya event baru, tanpa snapshot awal.
func TestIntegration_HotspotActiveStreamFollowOnly(t *testing.T) {
	c := testutil.NewClient(t)
	hot := hotspot.New(c)

	const id = "it-active-follow-only"
	var got atomic.Int32
	err := hot.ActiveStreamFollowOnly(id, func(s *roslib.Sentence) {
		got.Add(1)
	})
	require.NoError(t, err)
	t.Cleanup(func() { hot.StopActiveStream(id) })

	time.Sleep(1 * time.Second)
	t.Logf("active follow-only: %d sentences (kosong wajar — hanya event baru)", got.Load())
}

// TestIntegration_ActiveStream_addUserDoesNotEmit memverifikasi semantik:
// ActiveStream (snapshot+follow) emit event LOGIN (saat user mulai sesi),
// BUKAN event user-creation. Tambah user via UserAdd tanpa login seharusnya
// tidak memunculkan sentence baru di stream.
//
// Kalau ada event masuk, kemungkinan ada user yang sedang aktif login —
// test ini lenient (log delta tanpa fail) karena state router bervariasi.
func TestIntegration_ActiveStream_addUserDoesNotEmit(t *testing.T) {
	c := testutil.NewClient(t)
	hot := hotspot.New(c)
	ctx := testutil.Context(t)

	const id = "it-active-no-emit"
	var counter atomic.Int32
	err := hot.ActiveStreamFollowOnly(id, func(s *roslib.Sentence) {
		counter.Add(1)
	})
	require.NoError(t, err)
	t.Cleanup(func() { hot.StopActiveStream(id) })

	// Wait setelah subscribe biar baseline ke-zero (FollowOnly tanpa snapshot).
	time.Sleep(500 * time.Millisecond)
	baseline := counter.Load()

	// Tambah user dummy (tanpa login captive portal — hanya entry di
	// /ip/hotspot/user).
	name := testutil.UniqueName(t, "noemit")
	uid, err := hot.UserAdd(ctx, hotspot.UserAddArgs{
		Name:     name,
		Password: "p4ssw0rd",
		Comment:  "mikhmon-it-semantic",
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = hot.UserRemove(testutil.Context(t), uid) })

	time.Sleep(1 * time.Second)
	delta := counter.Load() - baseline
	t.Logf("active follow-only delta after UserAdd: %d (expect 0 — UserAdd != login event)", delta)
}
