package network_test

import (
	"strings"
	"testing"
	"time"

	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/mikrotik/network"
	"github.com/stretchr/testify/require"
)

func skipIfRace(t *testing.T) {
	t.Helper()
	if testutil.RaceEnabled {
		t.Skip("skip: upstream race in go-routeros v3.0.1 ctxReader (Close vs Cancel)")
	}
}

func TestQueueStatsStreamParsed_registerSendsStatsCommand(t *testing.T) {
	skipIfRace(t)
	cs, srv := testutil.NewTestClientSet(t)
	srv.OnStream(tcpmock.MatchCommand("/queue/simple/print"))

	err := cs.Net.QueueStatsStreamParsed("queue-stats", time.Second, func(_ network.QueueSimpleWithStats) {})
	require.NoError(t, err)
	t.Cleanup(func() { _ = cs.Net.StopStream("queue-stats") })

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/queue/simple/print"), "queue stats command")
	require.Contains(t, got, "stats")
}

func TestQueueStatsStreamParsed_eventDelivered(t *testing.T) {
	skipIfRace(t)
	cs, srv := testutil.NewTestClientSet(t)
	srv.OnStream(tcpmock.MatchCommand("/queue/simple/print"))

	received := make(chan network.QueueSimpleWithStats, 1)
	err := cs.Net.QueueStatsStreamParsed("queue-stats-event", time.Second, func(q network.QueueSimpleWithStats) {
		received <- q
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = cs.Net.StopStream("queue-stats-event") })

	tag := awaitNetworkStreamTag(t, srv, "/queue/simple/print", time.Second)
	require.NoError(t, srv.EmitToStream(tag,
		"=.id=*1",
		"=name=alice-queue",
		"=target=10.0.0.2/32",
		"=rate=1M/2M",
		"=total-rate=3M",
		"=packet-rate=10/20",
		"=bytes=1000/2000",
		"=total-bytes=3000",
	))

	select {
	case q := <-received:
		require.Equal(t, "alice-queue", q.Name)
		require.Equal(t, "1M/2M", q.Rate)
		require.Equal(t, "3M", q.TotalRate)
		require.Equal(t, "10/20", q.PacketRate)
		require.Equal(t, "3000", q.TotalBytes)
	case <-time.After(2 * time.Second):
		t.Fatal("did not receive parsed queue stats")
	}
}

func awaitNetworkStreamTag(t *testing.T, srv *tcpmock.Server, command string, timeout time.Duration) string {
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
