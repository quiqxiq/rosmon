package workflows_test

import (
	"strings"
	"testing"
	"time"

	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/workflows"
	"github.com/stretchr/testify/require"
)

func skipIfRace(t *testing.T) {
	t.Helper()
	if testutil.RaceEnabled {
		t.Skip("skip: upstream race in go-routeros v3.0.1 ctxReader (Close vs Cancel)")
	}
}

func TestPPPInactiveStream_emitsAddedRemovedAdded(t *testing.T) {
	skipIfRace(t)
	cs, srv := testutil.NewTestClientSet(t)
	srv.OnStream(tcpmock.MatchCommand("/ppp/active/print"))
	srv.OnStream(tcpmock.MatchCommand("/ppp/secret/print"))

	events := make(chan string, 8)
	err := cs.WF.PPPInactiveStream("ppp-inactive", func(e workflows.PPPInactiveEvent) {
		events <- e.Action + ":" + e.Name
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = cs.WF.StopPPPInactiveStream("ppp-inactive") })

	secretTag := awaitWorkflowStreamTag(t, srv, "/ppp/secret/print", time.Second)
	activeTag := awaitWorkflowStreamTag(t, srv, "/ppp/active/print", time.Second)

	require.NoError(t, srv.EmitToStream(secretTag, "=.id=*S1", "=name=alice", "=disabled=false"))
	require.Equal(t, "added:alice", awaitWorkflowString(t, events))

	require.NoError(t, srv.EmitToStream(activeTag, "=.id=*A1", "=name=alice"))
	require.Equal(t, "removed:alice", awaitWorkflowString(t, events))

	require.NoError(t, srv.EmitToStream(activeTag, "=.id=*A1", "=.dead=true"))
	require.Equal(t, "added:alice", awaitWorkflowString(t, events))
}

// TestPPPInactiveStream_addressTrackedFromActive verifies bahwa state machine
// catat `address` dari /ppp/active stream dan kembalikan field tersebut di
// event inactive berikutnya (last-known IP) — sesuai spec PPPInactiveEvent.
func TestPPPInactiveStream_addressTrackedFromActive(t *testing.T) {
	skipIfRace(t)
	cs, srv := testutil.NewTestClientSet(t)
	srv.OnStream(tcpmock.MatchCommand("/ppp/active/print"))
	srv.OnStream(tcpmock.MatchCommand("/ppp/secret/print"))

	events := make(chan workflows.PPPInactiveEvent, 8)
	err := cs.WF.PPPInactiveStream("ppp-inactive-addr", func(e workflows.PPPInactiveEvent) {
		events <- e
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = cs.WF.StopPPPInactiveStream("ppp-inactive-addr") })

	secretTag := awaitWorkflowStreamTag(t, srv, "/ppp/secret/print", time.Second)
	activeTag := awaitWorkflowStreamTag(t, srv, "/ppp/active/print", time.Second)

	// 1) Secret muncul → "added", belum ada address.
	require.NoError(t, srv.EmitToStream(secretTag, "=.id=*S1", "=name=bob", "=disabled=false", "=profile=vip"))
	ev := awaitWorkflowEvent(t, events)
	require.Equal(t, "added", ev.Action)
	require.Equal(t, "bob", ev.Name)
	require.Empty(t, ev.Address, "address kosong sebelum active pernah dilihat")

	// 2) Active masuk dengan address → "removed" inactive.
	require.NoError(t, srv.EmitToStream(activeTag, "=.id=*A1", "=name=bob", "=address=10.20.30.40"))
	ev = awaitWorkflowEvent(t, events)
	require.Equal(t, "removed", ev.Action)

	// 3) Active hilang → "added" inactive lagi, kali ini Address = last-known IP.
	require.NoError(t, srv.EmitToStream(activeTag, "=.id=*A1", "=.dead=true"))
	ev = awaitWorkflowEvent(t, events)
	require.Equal(t, "added", ev.Action)
	require.Equal(t, "bob", ev.Name)
	require.Equal(t, "vip", ev.Profile)
	require.Equal(t, "10.20.30.40", ev.Address, "Address harus = last-known IP dari /ppp/active")
}

func TestHotspotInactiveStream_emitsAddedRemovedAdded(t *testing.T) {
	skipIfRace(t)
	cs, srv := testutil.NewTestClientSet(t)
	srv.OnStream(tcpmock.MatchCommand("/ip/hotspot/active/print"))
	srv.OnStream(tcpmock.MatchCommand("/ip/hotspot/user/print"))

	events := make(chan string, 8)
	err := cs.WF.HotspotInactiveStream("hotspot-inactive", func(e workflows.HotspotInactiveEvent) {
		events <- e.Action + ":" + e.User.Name
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = cs.WF.StopHotspotInactiveStream("hotspot-inactive") })

	userTag := awaitWorkflowStreamTag(t, srv, "/ip/hotspot/user/print", time.Second)
	activeTag := awaitWorkflowStreamTag(t, srv, "/ip/hotspot/active/print", time.Second)

	require.NoError(t, srv.EmitToStream(userTag, "=.id=*U1", "=name=alice", "=disabled=false"))
	require.Equal(t, "added:alice", awaitWorkflowString(t, events))

	require.NoError(t, srv.EmitToStream(activeTag, "=.id=*A1", "=user=alice"))
	require.Equal(t, "removed:alice", awaitWorkflowString(t, events))

	require.NoError(t, srv.EmitToStream(activeTag, "=.id=*A1", "=.dead=true"))
	require.Equal(t, "added:alice", awaitWorkflowString(t, events))
}

func awaitWorkflowStreamTag(t *testing.T, srv *tcpmock.Server, command string, timeout time.Duration) string {
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

func awaitWorkflowString(t *testing.T, ch <-chan string) string {
	t.Helper()
	select {
	case got := <-ch:
		return got
	case <-time.After(2 * time.Second):
		t.Fatal("did not receive event")
	}
	return ""
}

func awaitWorkflowEvent(t *testing.T, ch <-chan workflows.PPPInactiveEvent) workflows.PPPInactiveEvent {
	t.Helper()
	select {
	case got := <-ch:
		return got
	case <-time.After(2 * time.Second):
		t.Fatal("did not receive event")
	}
	return workflows.PPPInactiveEvent{}
}
