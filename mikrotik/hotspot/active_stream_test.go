package hotspot_test

import (
	"strings"
	"testing"
	"time"

	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/stretchr/testify/require"
)

// skipIfRace skip test kalau race detector aktif. go-routeros v3.0.1 punya
// race internal antara ctxReader.Close() dan ctxReader.Cancel() saat listener
// teardown (proto/io_context.go close + send pada channel yang sama tanpa
// mutex). Race detector tetap flag walau goroutine sudah selesai. Test
// streaming hotspot tetap PASS tanpa -race; jalankan pakai
// `go test ./mikrotik/hotspot/...` untuk validasi fungsional.
func skipIfRace(t *testing.T) {
	t.Helper()
	if testutil.RaceEnabled {
		t.Skip("skip: upstream race in go-routeros v3.0.1 ctxReader (Close vs Cancel)")
	}
}

// TestActiveStream_registerSendsFollowCommand verifikasi ActiveStream mengirim
// /ip/hotspot/active/print dengan flag =follow= ke router.
func TestActiveStream_registerSendsFollowCommand(t *testing.T) {
	skipIfRace(t)
	cs, srv := testutil.NewTestClientSet(t)

	// Stream handler agar tag dilacak; tidak push event.
	srv.OnStream(tcpmock.MatchCommand("/ip/hotspot/active/print"))

	err := cs.Hot.ActiveStream("test-follow", func(s *roslib.Sentence) {})
	require.NoError(t, err)
	t.Cleanup(func() { _ = cs.Hot.StopActiveStream("test-follow") })

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ip/hotspot/active/print"), "active follow command")
	require.Contains(t, got, "follow")
}

// TestActiveStream_followOnly_sendsFollowOnlyFlag verifikasi varian follow-only
// menggunakan flag =follow-only=, bukan =follow=.
func TestActiveStream_followOnly_sendsFollowOnlyFlag(t *testing.T) {
	skipIfRace(t)
	cs, srv := testutil.NewTestClientSet(t)

	srv.OnStream(tcpmock.MatchCommand("/ip/hotspot/active/print"))

	err := cs.Hot.ActiveStreamFollowOnly("test-follow-only", func(s *roslib.Sentence) {})
	require.NoError(t, err)
	t.Cleanup(func() { _ = cs.Hot.StopActiveStream("test-follow-only") })

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ip/hotspot/active/print"), "active follow-only command")
	require.Contains(t, got, "follow-only")
}

// TestActiveStream_unregisterSendsCancel verifikasi StopActiveStream
// memicu /cancel ke router.
func TestActiveStream_unregisterSendsCancel(t *testing.T) {
	skipIfRace(t)
	cs, srv := testutil.NewTestClientSet(t)

	srv.OnStream(tcpmock.MatchCommand("/ip/hotspot/active/print"))

	err := cs.Hot.ActiveStream("cancel-test", func(s *roslib.Sentence) {})
	require.NoError(t, err)
	// Tunggu sampai server menerima command awal.
	srv.AssertReceived(t, tcpmock.MatchCommand("/ip/hotspot/active/print"), "initial follow command")

	stopped := cs.Hot.StopActiveStream("cancel-test")
	require.True(t, stopped)

	// /cancel harus muncul (mengandung =tag=...).
	srv.AssertReceived(t, tcpmock.MatchCommand("/cancel"), "cancel command after stop")
}

// TestActiveStream_eventDelivered verifikasi event yang di-emit oleh server
// sampai ke handler.
func TestActiveStream_eventDelivered(t *testing.T) {
	skipIfRace(t)
	cs, srv := testutil.NewTestClientSet(t)
	srv.OnStream(tcpmock.MatchCommand("/ip/hotspot/active/print"))

	received := make(chan *roslib.Sentence, 4)
	err := cs.Hot.ActiveStream("event-test", func(s *roslib.Sentence) {
		select {
		case received <- s:
		default:
		}
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = cs.Hot.StopActiveStream("event-test") })

	// Cari tag yang dipakai roslib untuk command ini.
	tag := awaitStreamTag(t, srv, "/ip/hotspot/active/print", 1*time.Second)

	require.NoError(t, srv.EmitToStream(tag,
		"=.id=*1",
		"=user=alice",
		"=address=10.0.0.5",
		"=mac-address=aa:bb:cc:dd:ee:ff",
	))

	select {
	case s := <-received:
		require.Equal(t, "alice", s.Get("user"))
		require.Equal(t, "10.0.0.5", s.Get("address"))
	case <-time.After(2 * time.Second):
		t.Fatal("did not receive emitted sentence")
	}
}

// awaitStreamTag tunggu sampai server menerima command dengan command path
// tertentu, lalu ekstrak .tag dari sentence itu.
func awaitStreamTag(t *testing.T, srv *tcpmock.Server, command string, timeout time.Duration) string {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		for _, w := range srv.Received() {
			if len(w) > 0 && w[0] == command {
				for _, word := range w {
					if strings.HasPrefix(word, ".tag=") {
						return word[len(".tag="):]
					}
				}
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("did not see command %s with .tag", command)
	return ""
}
