package sse_test

import (
	"strings"
	"testing"
	"time"

	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/api/sse"
	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/stretchr/testify/require"
)

// Test ini exercise pipeline end-to-end:
//   roslib.Device (mock) → hotspot.ActiveStream → broker.Publish → subscriber chan
//
// Karena melibatkan stream lifecycle go-routeros (yang punya race detector
// flag di v3.0.1 ctxReader), skip kalau -race aktif. Coverage tetap di-run
// via `go test ./api/sse/...` tanpa flag race.
func skipIfRace(t *testing.T) {
	t.Helper()
	if testutil.RaceEnabled {
		t.Skip("skip: upstream race in go-routeros v3.0.1 ctxReader")
	}
}

// buildHotspotActiveBroker memasang broker pakai hub yang sama, dengan
// startFn yang register ActiveStream ke device dan publish setiap !re ke
// broker. stopFn unregister stream.
func buildHotspotActiveBroker(t *testing.T, hub *sse.Hub, cs interface {
	hotspotActiveStream(id string, h func(*roslib.Sentence)) error
	hotspotStopActive(id string) bool
}) *sse.Broker {
	streamID := "test-active"
	topic := sse.TopicHotspotActive
	return hub.GetOrCreate(topic,
		func(b *sse.Broker) error {
			return cs.hotspotActiveStream(streamID, func(s *roslib.Sentence) {
				b.Publish(sse.Event{Type: "change", Data: sentenceMap(s)})
			})
		},
		func() {
			cs.hotspotStopActive(streamID)
		},
	)
}

// hotspotAdapter membungkus *devmgr.ClientSet supaya cocok dengan
// interface yang dibutuhkan buildHotspotActiveBroker (memungkinkan test
// signature pendek tanpa import siklus).
type hotspotAdapter struct {
	stream func(id string, h func(*roslib.Sentence)) error
	stop   func(id string) bool
}

func (a hotspotAdapter) hotspotActiveStream(id string, h func(*roslib.Sentence)) error {
	return a.stream(id, h)
}
func (a hotspotAdapter) hotspotStopActive(id string) bool { return a.stop(id) }

// TestBroker_loginEvent_emitsSSE mock-device emit row login → broker fan-out
// ke subscriber.
func TestBroker_loginEvent_emitsSSE(t *testing.T) {
	skipIfRace(t)
	cs, srv := testutil.NewTestClientSet(t)
	srv.OnStream(tcpmock.MatchCommand("/ip/hotspot/active/print"))

	hub := sse.NewHub()
	broker := buildHotspotActiveBroker(t, hub, hotspotAdapter{
		stream: cs.Hot.ActiveStream,
		stop:   cs.Hot.StopActiveStream,
	})

	ch, err := broker.Subscribe("c1")
	require.NoError(t, err)
	t.Cleanup(func() { broker.Unsubscribe("c1") })

	tag := awaitStreamTag(t, srv, "/ip/hotspot/active/print", 1*time.Second)

	require.NoError(t, srv.EmitToStream(tag,
		"=.id=*5",
		"=user=alice",
		"=address=10.0.0.5",
		"=mac-address=aa:bb:cc:dd:ee:ff",
	))

	select {
	case ev := <-ch:
		require.Equal(t, "change", ev.Type)
		data, ok := ev.Data.(map[string]string)
		require.True(t, ok, "expected map[string]string, got %T", ev.Data)
		require.Equal(t, "alice", data["user"])
		require.Equal(t, "10.0.0.5", data["address"])
	case <-time.After(2 * time.Second):
		t.Fatal("subscriber did not receive login event")
	}
}

// TestBroker_logoutEvent_deadFlag verifikasi delta `.dead=true` di-forward
// ke subscriber sebagai event change dengan flag dead.
func TestBroker_logoutEvent_deadFlag(t *testing.T) {
	skipIfRace(t)
	cs, srv := testutil.NewTestClientSet(t)
	srv.OnStream(tcpmock.MatchCommand("/ip/hotspot/active/print"))

	hub := sse.NewHub()
	broker := buildHotspotActiveBroker(t, hub, hotspotAdapter{
		stream: cs.Hot.ActiveStream,
		stop:   cs.Hot.StopActiveStream,
	})

	ch, err := broker.Subscribe("c1")
	require.NoError(t, err)
	t.Cleanup(func() { broker.Unsubscribe("c1") })

	tag := awaitStreamTag(t, srv, "/ip/hotspot/active/print", 1*time.Second)
	require.NoError(t, srv.EmitToStream(tag, "=.id=*5", "=.dead=true"))

	select {
	case ev := <-ch:
		data := ev.Data.(map[string]string)
		require.Equal(t, "true", data[".dead"])
	case <-time.After(2 * time.Second):
		t.Fatal("subscriber did not receive logout event")
	}
}

// sentenceMap convert roslib.Sentence ke map untuk Event.Data — encoding
// JSON di writer layer. Tidak masalah simple — test cuma cek key/value.
func sentenceMap(s *roslib.Sentence) map[string]string {
	return s.Map()
}

// awaitStreamTag tunggu sampai tcpmock menerima sentence command tertentu
// dan ekstrak .tag-nya.
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
