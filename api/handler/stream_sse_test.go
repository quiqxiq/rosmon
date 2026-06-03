package handler_test

import (
	"bufio"
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/api/sse"
	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/service/netstream"
	"github.com/stretchr/testify/require"
)

func setupStreamEngine(t *testing.T) (*gin.Engine, *tcpmock.Server) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	cs, srv := testutil.NewTestClientSet(t)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Params = append(c.Params, gin.Param{Key: "device_id", Value: "dev1"})
		api.SetClients(c, cs)
		c.Set("request_id", "req-"+strings.TrimPrefix(c.FullPath(), "/"))
		c.Next()
	})

	hub := sse.NewHub()
	ns := netstream.New(hub, nil, nil) // influx nil = live-only (cukup untuk test SSE)
	handler.NewStream(hub, cs.Hot, cs.Sys, cs.Net, cs.PPP, cs.Log, cs.WF, ns).Register(r.Group("/api"))
	return r, srv
}

func TestStream_HotspotUsers_emitsSSE(t *testing.T) {
	skipHandlerRace(t)
	r, srv := setupStreamEngine(t)
	srv.OnStream(tcpmock.MatchCommand("/ip/hotspot/user/print"))

	res := openSSE(t, r, "/api/stream/hotspot/users")
	require.Equal(t, http.StatusOK, res.StatusCode)
	require.Equal(t, "text/event-stream", res.Header.Get("Content-Type"))

	tag := awaitHandlerStreamTag(t, srv, "/ip/hotspot/user/print", time.Second)
	require.NoError(t, srv.EmitToStream(tag,
		"=.id=*1",
		"=name=alice",
		"=profile=default",
		"=comment=active user",
	))

	got := readSSEEvent(t, res.Body, 2*time.Second)
	require.Contains(t, got, "event: change")
	require.Contains(t, got, `"name":"alice"`)
	require.Contains(t, got, `"profile":"default"`)
}

func TestStream_HotspotUsers_followOnlySendsCommand(t *testing.T) {
	skipHandlerRace(t)
	r, srv := setupStreamEngine(t)
	srv.OnStream(tcpmock.MatchCommand("/ip/hotspot/user/print"))

	res := openSSE(t, r, "/api/stream/hotspot/users?mode=follow-only")
	require.Equal(t, http.StatusOK, res.StatusCode)

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ip/hotspot/user/print"), "hotspot user follow-only stream")
	require.Contains(t, got, "follow-only")
}

func TestStream_HotspotInactive_emitsSSE(t *testing.T) {
	skipHandlerRace(t)
	r, srv := setupStreamEngine(t)
	srv.OnStream(tcpmock.MatchCommand("/ip/hotspot/active/print"))
	srv.OnStream(tcpmock.MatchCommand("/ip/hotspot/user/print"))

	res := openSSE(t, r, "/api/stream/hotspot/inactive")
	require.Equal(t, http.StatusOK, res.StatusCode)

	userTag := awaitHandlerStreamTag(t, srv, "/ip/hotspot/user/print", time.Second)
	require.NoError(t, srv.EmitToStream(userTag,
		"=.id=*2",
		"=name=bob",
		"=profile=default",
		"=disabled=false",
	))

	got := readSSEEvent(t, res.Body, 2*time.Second)
	require.Contains(t, got, "event: inactive")
	require.Contains(t, got, `"action":"added"`)
	require.Contains(t, got, `"name":"bob"`)
}

func TestStream_PPPSecrets_emitsSSE(t *testing.T) {
	skipHandlerRace(t)
	r, srv := setupStreamEngine(t)
	srv.OnStream(tcpmock.MatchCommand("/ppp/secret/print"))

	res := openSSE(t, r, "/api/stream/ppp/secrets")
	require.Equal(t, http.StatusOK, res.StatusCode)

	tag := awaitHandlerStreamTag(t, srv, "/ppp/secret/print", time.Second)
	require.NoError(t, srv.EmitToStream(tag,
		"=.id=*3",
		"=name=charlie",
		"=service=pppoe",
		"=profile=default",
	))

	got := readSSEEvent(t, res.Body, 2*time.Second)
	require.Contains(t, got, "event: change")
	require.Contains(t, got, `"name":"charlie"`)
	require.Contains(t, got, `"service":"pppoe"`)
}

func TestStream_PPPSecrets_followOnlySendsCommand(t *testing.T) {
	skipHandlerRace(t)
	r, srv := setupStreamEngine(t)
	srv.OnStream(tcpmock.MatchCommand("/ppp/secret/print"))

	res := openSSE(t, r, "/api/stream/ppp/secrets?mode=follow-only")
	require.Equal(t, http.StatusOK, res.StatusCode)

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ppp/secret/print"), "ppp secret follow-only stream")
	require.Contains(t, got, "follow-only")
}

func TestStream_PPPInactive_emitsSSE(t *testing.T) {
	skipHandlerRace(t)
	r, srv := setupStreamEngine(t)
	srv.OnStream(tcpmock.MatchCommand("/ppp/active/print"))
	srv.OnStream(tcpmock.MatchCommand("/ppp/secret/print"))

	res := openSSE(t, r, "/api/stream/ppp/inactive")
	require.Equal(t, http.StatusOK, res.StatusCode)

	secretTag := awaitHandlerStreamTag(t, srv, "/ppp/secret/print", time.Second)
	require.NoError(t, srv.EmitToStream(secretTag,
		"=.id=*4",
		"=name=dina",
		"=service=pppoe",
		"=profile=default",
		"=disabled=false",
	))

	got := readSSEEvent(t, res.Body, 2*time.Second)
	require.Contains(t, got, "event: inactive")
	require.Contains(t, got, `"action":"added"`)
	require.Contains(t, got, `"name":"dina"`)
}

func TestStream_QueueStats_emitsParsedSSE(t *testing.T) {
	skipHandlerRace(t)
	r, srv := setupStreamEngine(t)
	// Queue stats = streaming (Listen) via netstream; mock balas !re+!done.
	srv.OnSentence(tcpmock.MatchCommand("/queue/simple/print"),
		tcpmock.ReReply(
			"=.id=*5",
			"=name=q1",
			"=target=10.0.0.0/24",
			"=bytes=100/200",
			"=packets=1/2",
			"=rate=10/20",
			"=total-rate=30",
		),
		tcpmock.DoneReply(),
	)

	res := openSSE(t, r, "/api/stream/network/queues/stats?interval=500ms")
	require.Equal(t, http.StatusOK, res.StatusCode)

	got := readSSEEvent(t, res.Body, 3*time.Second)
	require.Contains(t, got, "event: stats")
	require.Contains(t, got, `"name":"q1"`)
	require.Contains(t, got, `"bytes":"100/200"`)
	require.Contains(t, got, `"total_rate":"30"`)
}

func skipHandlerRace(t *testing.T) {
	t.Helper()
	if testutil.RaceEnabled {
		t.Skip("skip: upstream race in go-routeros v3.0.1 ctxReader")
	}
}

func openSSE(t *testing.T, r *gin.Engine, path string) *http.Response {
	t.Helper()
	ts := httptest.NewServer(r)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, ts.URL+path, nil)
	require.NoError(t, err)
	res, err := ts.Client().Do(req)
	if err != nil {
		cancel()
		ts.Close()
	}
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = res.Body.Close()
		cancel()
		ts.Close()
	})
	return res
}

func awaitHandlerStreamTag(t *testing.T, srv *tcpmock.Server, command string, timeout time.Duration) string {
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

func readSSEEvent(t *testing.T, body interface{ Read([]byte) (int, error) }, timeout time.Duration) string {
	t.Helper()
	lines := make(chan string, 16)
	go func() {
		scanner := bufio.NewScanner(body)
		for scanner.Scan() {
			lines <- scanner.Text()
		}
	}()

	deadline := time.After(timeout)
	var b strings.Builder
	for {
		select {
		case line := <-lines:
			if line == "" && b.Len() > 0 {
				return b.String()
			}
			if line != "" {
				b.WriteString(line)
				b.WriteByte('\n')
			}
		case <-deadline:
			t.Fatalf("did not receive SSE event; partial=%q", b.String())
			return ""
		}
	}
}
