package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/roslib-mikhmon/internal/ratelimit"
	"github.com/quiqxiq/roslib-mikhmon/service/auth"
)

func TestRequirePerIPRate_429AfterBurst(t *testing.T) {
	gin.SetMode(gin.TestMode)
	lim := ratelimit.New(1, 3, time.Minute)
	t.Cleanup(lim.Close)

	r := gin.New()
	r.Use(RequirePerIPRate(lim))
	r.GET("/ping", func(c *gin.Context) { c.String(200, "ok") })

	// 3 request burst → 200
	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/ping", nil)
		req.RemoteAddr = "1.2.3.4:1111"
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Errorf("burst %d: status = %d", i, w.Code)
		}
	}
	// Request ke-4 → 429
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.RemoteAddr = "1.2.3.4:1111"
	r.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("4th: status = %d, want 429", w.Code)
	}
	if w.Header().Get("Retry-After") == "" {
		t.Error("Retry-After header missing on 429")
	}
}

func TestRequirePerUserRate_keyedByClaims(t *testing.T) {
	gin.SetMode(gin.TestMode)
	signer := auth.NewSigner("0123456789abcdef0123456789abcdef", 15*time.Minute, time.Hour)
	lim := ratelimit.New(1, 2, time.Minute)
	t.Cleanup(lim.Close)

	r := gin.New()
	r.Use(RequireAuth(signer), RequirePerUserRate(lim))
	r.GET("/p", func(c *gin.Context) { c.String(200, "ok") })

	tokA, _ := signer.SignAccess(1, "alice", auth.RoleOperator)
	tokB, _ := signer.SignAccess(2, "bob", auth.RoleOperator)

	exhaust := func(tok string) int {
		for i := 0; i < 2; i++ {
			w := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/p", nil)
			req.Header.Set("Authorization", "Bearer "+tok)
			r.ServeHTTP(w, req)
			if w.Code != http.StatusOK {
				t.Fatalf("burst %d: status = %d", i, w.Code)
			}
		}
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/p", nil)
		req.Header.Set("Authorization", "Bearer "+tok)
		r.ServeHTTP(w, req)
		return w.Code
	}

	if code := exhaust(tokA); code != http.StatusTooManyRequests {
		t.Errorf("alice 3rd: status = %d, want 429", code)
	}
	// Bob: quota terpisah, masih bisa burst penuh.
	if code := exhaust(tokB); code != http.StatusTooManyRequests {
		t.Errorf("bob 3rd: status = %d, want 429", code)
	}
}

func TestRequirePerEndpointRate_keyIncludesEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)
	signer := auth.NewSigner("0123456789abcdef0123456789abcdef", 15*time.Minute, time.Hour)
	lim := ratelimit.New(1, 1, time.Minute)
	t.Cleanup(lim.Close)

	r := gin.New()
	r.Use(RequireAuth(signer))
	r.GET("/a", RequirePerEndpointRate(lim, "endpoint-a"), func(c *gin.Context) { c.String(200, "ok") })
	r.GET("/b", RequirePerEndpointRate(lim, "endpoint-b"), func(c *gin.Context) { c.String(200, "ok") })

	tok, _ := signer.SignAccess(1, "u", auth.RoleAdmin)

	// /a 1× → ok, 2× → 429
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/a", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("a1: %d", w.Code)
	}
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/a", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusTooManyRequests {
		t.Errorf("a2: %d, want 429", w.Code)
	}

	// /b masih punya quota terpisah karena beda endpoint name.
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/b", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Errorf("b1: %d", w.Code)
	}
}
