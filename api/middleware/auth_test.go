package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/roslib-mikhmon/service/auth"
)

const testSecret = "0123456789abcdef0123456789abcdef" // 32 char

func newAuthRouter(t *testing.T) (*gin.Engine, *auth.Signer) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	signer := auth.NewSigner(testSecret, 15*time.Minute, time.Hour)
	return r, signer
}

func TestRequireAuth_missingHeader(t *testing.T) {
	r, signer := newAuthRouter(t)
	r.GET("/protected", RequireAuth(signer), func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", w.Code)
	}
	if got := w.Header().Get("WWW-Authenticate"); got == "" {
		t.Errorf("WWW-Authenticate header not set")
	}
}

func TestRequireAuth_malformedHeader(t *testing.T) {
	r, signer := newAuthRouter(t)
	r.GET("/protected", RequireAuth(signer), func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	cases := []string{"NotBearer abc", "Bearer", "Bearer "}
	for _, h := range cases {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/protected", nil)
		req.Header.Set("Authorization", h)
		r.ServeHTTP(w, req)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("header %q: status = %d, want 401", h, w.Code)
		}
	}
}

func TestRequireAuth_invalidToken(t *testing.T) {
	r, signer := newAuthRouter(t)
	r.GET("/protected", RequireAuth(signer), func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer garbage.jwt.token")
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", w.Code)
	}
}

func TestRequireAuth_validToken_setsClaims(t *testing.T) {
	r, signer := newAuthRouter(t)
	r.GET("/protected", RequireAuth(signer), func(c *gin.Context) {
		claims, ok := ClaimsFrom(c)
		if !ok {
			t.Error("claims not set")
		}
		c.JSON(200, gin.H{"uid": claims.UserID, "role": claims.Role})
	})

	tok, err := signer.SignAccess(7, "alice", auth.RoleOperator)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", w.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body["uid"].(float64) != 7 {
		t.Errorf("uid = %v, want 7", body["uid"])
	}
}

func TestRequireAuth_rejectsRefreshToken(t *testing.T) {
	r, signer := newAuthRouter(t)
	r.GET("/protected", RequireAuth(signer), func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	refresh, _, _ := signer.SignRefresh(1, "u", auth.RoleViewer, auth.NewJTI())

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req.Header.Set("Authorization", "Bearer "+refresh)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401 (refresh used as access)", w.Code)
	}
}

func TestRequireRole_allowed(t *testing.T) {
	r, signer := newAuthRouter(t)
	r.GET("/admin", RequireAuth(signer), RequireRole(auth.RoleAdmin), func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	tok, _ := signer.SignAccess(1, "root", auth.RoleAdmin)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("status = %d, want 200", w.Code)
	}
}

func TestRequireRole_forbidden(t *testing.T) {
	r, signer := newAuthRouter(t)
	r.GET("/admin", RequireAuth(signer), RequireRole(auth.RoleAdmin), func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	tok, _ := signer.SignAccess(1, "view", auth.RoleViewer)

	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Errorf("status = %d, want 403", w.Code)
	}
}

func TestRequireRole_multipleAllowed(t *testing.T) {
	r, signer := newAuthRouter(t)
	r.GET("/op", RequireAuth(signer), RequireRole(auth.RoleAdmin, auth.RoleOperator), func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	cases := []struct {
		role string
		want int
	}{
		{auth.RoleAdmin, 200},
		{auth.RoleOperator, 200},
		{auth.RoleViewer, 403},
	}
	for _, tc := range cases {
		tok, _ := signer.SignAccess(1, "u", tc.role)
		w := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/op", nil)
		req.Header.Set("Authorization", "Bearer "+tok)
		r.ServeHTTP(w, req)
		if w.Code != tc.want {
			t.Errorf("role %s: status = %d, want %d", tc.role, w.Code, tc.want)
		}
	}
}
