package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/stretchr/testify/require"
)

func setupNetworkPoolEngine(t *testing.T) (*gin.Engine, *tcpmock.Server) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	cs, srv := testutil.NewTestClientSet(t)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		api.SetClients(c, cs)
		c.Next()
	})

	handler.NewNetworkPool(cs.Net).Register(r.Group("/api"))
	return r, srv
}

func TestNetworkPool_List_returnsPools(t *testing.T) {
	if testutil.RaceEnabled {
		t.Skip("skip: upstream race in go-routeros v3.0.1 ctxReader")
	}
	r, srv := setupNetworkPoolEngine(t)
	srv.OnSentence(tcpmock.MatchCommand("/ip/pool/print"),
		tcpmock.ReReply("=.id=*1", "=name=pool1", "=ranges=10.0.0.2-10.0.0.254", "=total=253", "=used=10", "=available=243"),
		tcpmock.DoneReply(),
	)

	w := httptest.NewRecorder()
	req := newPoolRequest(t, http.MethodGet, "/api/network/pools", nil)
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var env struct {
		Data []struct {
			ID        string `json:"id"`
			Name      string `json:"name"`
			Total     int64  `json:"total"`
			Used      int64  `json:"used"`
			Available int64  `json:"available"`
		} `json:"data"`
		Meta map[string]int `json:"meta"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &env))
	require.Len(t, env.Data, 1)
	require.Equal(t, "*1", env.Data[0].ID)
	require.Equal(t, "pool1", env.Data[0].Name)
	require.Equal(t, int64(253), env.Data[0].Total)
	require.Equal(t, int64(10), env.Data[0].Used)
	require.Equal(t, int64(243), env.Data[0].Available)
	require.Equal(t, 1, env.Meta["count"])
}

func TestNetworkPool_GetByName_returnsPool(t *testing.T) {
	if testutil.RaceEnabled {
		t.Skip("skip: upstream race in go-routeros v3.0.1 ctxReader")
	}
	r, srv := setupNetworkPoolEngine(t)
	srv.OnSentence(tcpmock.MatchCommand("/ip/pool/print"),
		tcpmock.ReReply("=.id=*2", "=name=pool2", "=ranges=10.0.1.2-10.0.1.254", "=total=253", "=used=1", "=available=252"),
		tcpmock.DoneReply(),
	)

	w := httptest.NewRecorder()
	req := newPoolRequest(t, http.MethodGet, "/api/network/pools/by-name/pool2", nil)
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ip/pool/print"), "pool by name")
	require.Contains(t, got, "?name=pool2")
}

func TestNetworkPool_Create_callsPoolAdd(t *testing.T) {
	if testutil.RaceEnabled {
		t.Skip("skip: upstream race in go-routeros v3.0.1 ctxReader")
	}
	r, srv := setupNetworkPoolEngine(t)
	srv.OnSentence(tcpmock.MatchCommand("/ip/pool/add"), tcpmock.DoneReply("=ret=*3"))

	body := bytes.NewBufferString(`{"name":"pool3","ranges":"10.0.2.2-10.0.2.254","comment":"created"}`)
	w := httptest.NewRecorder()
	req := newPoolRequest(t, http.MethodPost, "/api/network/pools", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ip/pool/add"), "pool add")
	require.Contains(t, got, "=name=pool3")
	require.Contains(t, got, "=ranges=10.0.2.2-10.0.2.254")
	require.Contains(t, got, "=comment=created")
}

func TestNetworkPool_Update_callsPoolSet(t *testing.T) {
	if testutil.RaceEnabled {
		t.Skip("skip: upstream race in go-routeros v3.0.1 ctxReader")
	}
	r, srv := setupNetworkPoolEngine(t)
	srv.OnSentence(tcpmock.MatchCommand("/ip/pool/set"), tcpmock.DoneReply())

	body := bytes.NewBufferString(`{"ranges":"10.0.3.2-10.0.3.254","comment":"updated"}`)
	w := httptest.NewRecorder()
	req := newPoolRequest(t, http.MethodPut, "/api/network/pools/*3", body)
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusNoContent, w.Code, "body: %s", w.Body.String())
	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ip/pool/set"), "pool set")
	require.Contains(t, got, "=numbers=*3")
	require.Contains(t, got, "=ranges=10.0.3.2-10.0.3.254")
	require.Contains(t, got, "=comment=updated")
}

func TestNetworkPool_Delete_callsPoolRemove(t *testing.T) {
	if testutil.RaceEnabled {
		t.Skip("skip: upstream race in go-routeros v3.0.1 ctxReader")
	}
	r, srv := setupNetworkPoolEngine(t)
	srv.OnSentence(tcpmock.MatchCommand("/ip/pool/remove"), tcpmock.DoneReply())

	w := httptest.NewRecorder()
	req := newPoolRequest(t, http.MethodDelete, "/api/network/pools/*3", nil)
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusNoContent, w.Code, "body: %s", w.Body.String())
	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ip/pool/remove"), "pool remove")
	require.Contains(t, got, "=numbers=*3")
}

func newPoolRequest(t *testing.T, method, target string, body io.Reader) *http.Request {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	t.Cleanup(cancel)
	req, err := http.NewRequestWithContext(ctx, method, target, body)
	require.NoError(t, err)
	return req
}
