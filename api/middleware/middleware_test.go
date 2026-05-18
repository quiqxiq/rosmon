package middleware

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
)

func newRouter(handlers ...gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	for _, h := range handlers {
		r.Use(h)
	}
	return r
}

func TestRequestID_generatesWhenMissing(t *testing.T) {
	r := newRouter(RequestID())
	r.GET("/", func(c *gin.Context) {
		id := c.GetString("request_id")
		if id == "" {
			t.Error("request_id not set in context")
		}
		c.String(http.StatusOK, id)
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)

	hdr := w.Header().Get(HeaderRequestID)
	if hdr == "" {
		t.Fatal("X-Request-ID response header not set")
	}
	if got := w.Body.String(); got != hdr {
		t.Errorf("context id (%q) != header id (%q)", got, hdr)
	}
	if len(hdr) != 16 {
		t.Errorf("generated ID len = %d, want 16 (8 bytes hex)", len(hdr))
	}
}

func TestRequestID_preservesClientHeader(t *testing.T) {
	r := newRouter(RequestID())
	r.GET("/", func(c *gin.Context) {
		c.String(http.StatusOK, c.GetString("request_id"))
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set(HeaderRequestID, "client-supplied-id-123")
	r.ServeHTTP(w, req)

	const want = "client-supplied-id-123"
	if got := w.Header().Get(HeaderRequestID); got != want {
		t.Errorf("response header = %q, want %q", got, want)
	}
	if got := w.Body.String(); got != want {
		t.Errorf("context id = %q, want %q", got, want)
	}
}

func TestRecovery_returnsEnvelope500(t *testing.T) {
	log := logrus.New()
	log.SetOutput(io.Discard)

	r := newRouter(Recovery(log))
	r.GET("/", func(c *gin.Context) {
		panic("boom test")
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", w.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("response not JSON: %v\nbody=%s", err, w.Body.String())
	}
	errBlock, _ := body["error"].(map[string]any)
	if errBlock == nil {
		t.Fatalf("missing error envelope: %s", w.Body.String())
	}
	if got, _ := errBlock["code"].(string); got != "INTERNAL" {
		t.Errorf("error.code = %q, want INTERNAL", got)
	}
}

func TestCORS_emptyOriginsIsNoOp(t *testing.T) {
	// Default: empty origins = no CORS headers (same-origin only).
	r := newRouter(CORS(nil))
	r.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "https://malicious.example.com")
	r.ServeHTTP(w, req)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q, want empty (no-op)", got)
	}
}

func TestCORS_explicitAllowlist(t *testing.T) {
	r := newRouter(CORS([]string{"https://app.example.com"}))
	r.GET("/", func(c *gin.Context) { c.Status(http.StatusOK) })

	// Origin yang di-allowlist
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "https://app.example.com")
	r.ServeHTTP(w, req)
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "https://app.example.com" {
		t.Errorf("allowed origin: got %q, want https://app.example.com", got)
	}

	// Origin yang TIDAK di-allowlist
	w2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/", nil)
	req2.Header.Set("Origin", "https://evil.example.com")
	r.ServeHTTP(w2, req2)
	if got := w2.Header().Get("Access-Control-Allow-Origin"); got == "https://evil.example.com" {
		t.Errorf("disallowed origin should not be echoed: got %q", got)
	}
}
