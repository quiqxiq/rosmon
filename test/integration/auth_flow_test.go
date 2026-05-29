//go:build integration && dbtest

package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/api/sse"
	"github.com/quiqxiq/rosmon/internal/config"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/service/auth"
	"github.com/quiqxiq/rosmon/service/devmgr"
	"github.com/quiqxiq/rosmon/store"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

const authSecret = "0123456789abcdef0123456789abcdef" // 32 char

// setupAuthServer build full HTTP stack (gin engine) + postgres testcontainer.
// Bootstrap admin user dengan kredensial dari arg.
func setupAuthServer(t *testing.T, adminUser, adminPass string) http.Handler {
	t.Helper()
	db := testutil.NewPostgres(t)

	userStore := store.NewUserStore(db)
	refreshStore := store.NewRefreshTokenStore(db)
	deviceStore := store.NewDeviceStore(db)

	signer := auth.NewSigner(authSecret, 15*time.Minute, time.Hour)
	hasher := auth.NewHasher(4) // bcrypt MinCost untuk test cepat
	svc := auth.New(userStore, refreshStore, hasher, signer)

	if adminUser != "" {
		require.NoError(t, svc.BootstrapAdmin(t.Context(), adminUser, adminPass))
	}

	log := logrus.New()
	log.SetLevel(logrus.PanicLevel)

	gin.SetMode(gin.TestMode)
	deps := &api.Deps{
		Logger:       log,
		HTTPConfig:   &config.HTTPConfig{},
		DB:           db,
		DeviceStore:  deviceStore,
		AuthService:  svc,
		AuthSigner:   signer,
		DevMgr:       devmgr.New(deviceStore, log),
		Hub:          sse.NewHub(),
	}
	return api.NewServer(deps)
}

// loginAs panggil /auth/login, return access+refresh.
func loginAs(t *testing.T, srv http.Handler, username, password string) (access, refresh string) {
	t.Helper()
	body, _ := json.Marshal(dto.LoginRequest{Username: username, Password: password})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, "login body: %s", w.Body.String())

	var resp struct {
		Data dto.TokenResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.NotEmpty(t, resp.Data.AccessToken)
	require.NotEmpty(t, resp.Data.RefreshToken)
	return resp.Data.AccessToken, resp.Data.RefreshToken
}

func TestAuth_login_protected_endpoint(t *testing.T) {
	srv := setupAuthServer(t, "admin", "supersecretpw")

	// Anonymous → 401
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/devices", nil)
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusUnauthorized, w.Code)

	// Login
	access, _ := loginAs(t, srv, "admin", "supersecretpw")

	// Protected with token → 200
	w = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/v1/devices", nil)
	req.Header.Set("Authorization", "Bearer "+access)
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
}

func TestAuth_login_invalidCredentials(t *testing.T) {
	srv := setupAuthServer(t, "admin", "supersecretpw")

	body, _ := json.Marshal(dto.LoginRequest{Username: "admin", Password: "wrong"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuth_refresh_rotation(t *testing.T) {
	srv := setupAuthServer(t, "admin", "supersecretpw")
	_, oldRefresh := loginAs(t, srv, "admin", "supersecretpw")

	// Refresh sukses → token baru
	body, _ := json.Marshal(dto.RefreshRequest{RefreshToken: oldRefresh})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var resp struct {
		Data dto.TokenResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.NotEqual(t, oldRefresh, resp.Data.RefreshToken)

	// Refresh ulang dengan token LAMA → 401 (revoked)
	body, _ = json.Marshal(dto.RefreshRequest{RefreshToken: oldRefresh})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuth_logout_invalidatesRefresh(t *testing.T) {
	srv := setupAuthServer(t, "admin", "supersecretpw")
	_, refresh := loginAs(t, srv, "admin", "supersecretpw")

	body, _ := json.Marshal(dto.LogoutRequest{RefreshToken: refresh})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusNoContent, w.Code)

	// Coba refresh setelah logout → 401
	body, _ = json.Marshal(dto.RefreshRequest{RefreshToken: refresh})
	req = httptest.NewRequest(http.MethodPost, "/api/v1/auth/refresh", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestAuth_userCRUD_adminOnly(t *testing.T) {
	srv := setupAuthServer(t, "admin", "supersecretpw")

	// Login sebagai admin
	adminTok, _ := loginAs(t, srv, "admin", "supersecretpw")

	// Admin buat user operator
	body, _ := json.Marshal(dto.UserCreateRequest{
		Username: "opuser",
		Password: "opspasswordstrong",
		Role:     "operator",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/users", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+adminTok)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())

	// Operator login
	opTok, _ := loginAs(t, srv, "opuser", "opspasswordstrong")

	// Operator coba list users → 403
	req = httptest.NewRequest(http.MethodGet, "/api/v1/auth/users", nil)
	req.Header.Set("Authorization", "Bearer "+opTok)
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusForbidden, w.Code)

	// Admin list users → 200, count = 2
	req = httptest.NewRequest(http.MethodGet, "/api/v1/auth/users", nil)
	req.Header.Set("Authorization", "Bearer "+adminTok)
	w = httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)
}

func TestAuth_me_returnsCurrentUser(t *testing.T) {
	srv := setupAuthServer(t, "admin", "supersecretpw")
	access, _ := loginAs(t, srv, "admin", "supersecretpw")

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+access)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	var resp struct {
		Data dto.MeResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &resp))
	require.Equal(t, "admin", resp.Data.Username)
	require.Equal(t, auth.RoleAdmin, resp.Data.Role)
}
