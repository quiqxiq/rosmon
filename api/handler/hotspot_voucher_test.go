package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/roslib-mikhmon/api/dto"
	"github.com/quiqxiq/roslib-mikhmon/api/handler"
	"github.com/quiqxiq/roslib-mikhmon/internal/tcpmock"
	"github.com/quiqxiq/roslib-mikhmon/internal/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupVoucherEngine bangun Gin engine dengan handler voucher terdaftar
// dan middleware injektor ClientSet (mock device).
func setupVoucherEngine(t *testing.T) (*gin.Engine, *tcpmock.Server) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	cs, srv := testutil.NewTestClientSet(t)
	r := gin.New()

	// Middleware inject ClientSet sebagai context value, mirip
	// DeviceMiddleware production tapi tanpa lookup slug.
	r.Use(func(c *gin.Context) {
		c.Set("device_clients", cs)
		c.Next()
	})

	g := r.Group("/api")
	handler.NewHotspotVoucher(cs.WF).Register(g)
	return r, srv
}

// TestVoucher_generate_50_callsUserAddBatch happy path: 50 voucher dibuat.
//
// TODO(upstream-flake): test ini PASS dalam isolasi (`-run` filter) tapi
// flake / hang sampai timeout saat dijalankan bersama full suite dengan
// `-race`. Akar masalah ada di go-routeros v3.0.1 — race condition di
// `proto/ctxReader.Close()` vs `Read()` saat banyak request paralel
// teardown koneksi (lihat stack trace di proto/io_context.go:50). Bukan
// regresi dari kode kami; library upstream perlu di-patch atau di-replace
// ke versi yang sudah fix. Pattern skip serupa sudah dipakai di
// TestVoucher_partialFailure_returns207 (gate via testutil.RaceEnabled).
func TestVoucher_generate_50_callsUserAddBatch(t *testing.T) {
	if testutil.RaceEnabled {
		t.Skip("skip: upstream race in go-routeros v3.0.1 ctxReader (see TODO above)")
	}
	r, srv := setupVoucherEngine(t)
	// OnSentence reply identik untuk semua 50 panggilan user/add — workflow
	// pakai ret untuk ID, test cuma cek count.
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/add"), tcpmock.DoneReply("=ret=*1"))

	req := dto.VoucherGenerateRequest{
		Length:    8,
		Charset:   "lower_number",
		Profile:   "default",
		BatchSize: 50,
	}
	body, _ := json.Marshal(req)
	w := httptest.NewRecorder()
	httpReq, _ := http.NewRequest(http.MethodPost, "/api/hotspot/vouchers/generate", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, httpReq)

	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	// Verify response shape.
	var env struct {
		Data dto.VoucherGenerateResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &env))
	assert.Equal(t, 50, env.Data.Count)
	assert.Len(t, env.Data.Vouchers, 50)
	assert.False(t, env.Data.Partial)

	// Verify mock receive 50 /ip/hotspot/user/add sentences.
	matches := srv.AssertReceivedAll(t, tcpmock.MatchCommand("/ip/hotspot/user/add"), 50)
	assert.Len(t, matches, 50)
}

// TestVoucher_partialFailure_returns207 — voucher ke-10 di-reply !trap;
// response 207 Multi-Status dengan 9 voucher OK + error field. Counter handler
// menentukan reply berdasarkan call ke-berapa.
func TestVoucher_partialFailure_returns207(t *testing.T) {
	if testutil.RaceEnabled {
		// go-routeros v3.0.1 race antara ctxReader.Close() dan Cancel saat
		// async error (!trap) trigger pull-down koneksi. Fungsional tetap
		// PASS tanpa -race.
		t.Skip("skip: upstream race in go-routeros v3.0.1 on !trap teardown")
	}
	r, srv := setupVoucherEngine(t)

	var calls atomic.Int32
	srv.OnSentenceFunc(tcpmock.MatchCommand("/ip/hotspot/user/add"), func(words []string) [][]string {
		n := calls.Add(1)
		if n <= 9 {
			return [][]string{tcpmock.DoneReply("=ret=*1")}
		}
		return [][]string{tcpmock.TrapReply("duplicate name", "7")}
	})

	req := dto.VoucherGenerateRequest{
		Length:    8,
		Charset:   "lower_number",
		Profile:   "default",
		BatchSize: 20,
	}
	body, _ := json.Marshal(req)
	w := httptest.NewRecorder()
	httpReq, _ := http.NewRequest(http.MethodPost, "/api/hotspot/vouchers/generate", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, httpReq)

	require.Equal(t, http.StatusMultiStatus, w.Code, "body: %s", w.Body.String())

	var env struct {
		Data dto.VoucherGenerateResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &env))
	assert.True(t, env.Data.Partial)
	assert.Equal(t, 9, env.Data.Count)
	assert.Len(t, env.Data.Vouchers, 9)
	assert.NotEmpty(t, env.Data.Error)
}

// TestVoucher_invalidSpec_returns400 — batch_size=0 → 400 ValidationErr.
// Tidak menyentuh mock (gin validator menolak duluan).
func TestVoucher_invalidSpec_returns400(t *testing.T) {
	r, _ := setupVoucherEngine(t)

	req := dto.VoucherGenerateRequest{
		Length:    8,
		Charset:   "lower_number",
		Profile:   "default",
		BatchSize: 0, // invalid
	}
	body, _ := json.Marshal(req)
	w := httptest.NewRecorder()
	httpReq, _ := http.NewRequest(http.MethodPost, "/api/hotspot/vouchers/generate", bytes.NewReader(body))
	httpReq.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, httpReq)

	assert.Equal(t, http.StatusBadRequest, w.Code, "body: %s", w.Body.String())
}
