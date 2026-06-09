package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/gin-gonic/gin"
)

// TestParseHistoryParams_intervalValidation verifikasi SQL injection guard
// di parseHistoryParams: interval harus parsable via time.ParseDuration
// dan reformat ke canonical string sebelum di-interpolasi ke SQL.
func TestParseHistoryParams_intervalValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cases := []struct {
		name           string
		interval       string
		wantOK         bool
		wantStatus     int
		wantCanonical  string
		wantErrorCode  string
	}{
		// Canonical = "<n> seconds" (format DataFusion-valid; bukan Go "1m0s").
		{
			name:          "valid 1m",
			interval:      "1m",
			wantOK:        true,
			wantStatus:    http.StatusOK,
			wantCanonical: "60 seconds",
		},
		{
			name:          "valid 30s",
			interval:      "30s",
			wantOK:        true,
			wantStatus:    http.StatusOK,
			wantCanonical: "30 seconds",
		},
		{
			name:          "valid 1h",
			interval:      "1h",
			wantOK:        true,
			wantStatus:    http.StatusOK,
			wantCanonical: "3600 seconds",
		},
		{
			name:          "SQL injection attempt rejected",
			interval:      "1m'; DROP TABLE x; --",
			wantOK:        false,
			wantStatus:    http.StatusBadRequest,
			wantErrorCode: "INVALID_INTERVAL",
		},
		{
			name:          "negative rejected",
			interval:      "-5m",
			wantOK:        false,
			wantStatus:    http.StatusBadRequest,
			wantErrorCode: "INVALID_INTERVAL",
		},
		{
			name:          "zero rejected",
			interval:      "0s",
			wantOK:        false,
			wantStatus:    http.StatusBadRequest,
			wantErrorCode: "INVALID_INTERVAL",
		},
		{
			name:          "empty rejected",
			interval:      "",
			wantOK:        false,
			wantStatus:    http.StatusBadRequest,
			wantErrorCode: "INVALID_INTERVAL",
		},
		{
			name:          "garbage rejected",
			interval:      "abc",
			wantOK:        false,
			wantStatus:    http.StatusBadRequest,
			wantErrorCode: "INVALID_INTERVAL",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, w := newTestContext("/api/v1/devices/r1/history/foo", url.Values{
				"interval": []string{tc.interval},
			})
			c.Params = gin.Params{{Key: "device_id", Value: "r1"}}

			params, ok := parseHistoryParams(c)
			if ok != tc.wantOK {
				t.Fatalf("parseHistoryParams ok = %v, want %v (resp body=%s)", ok, tc.wantOK, w.Body.String())
			}
			if w.Code != tc.wantStatus {
				t.Errorf("status = %d, want %d", w.Code, tc.wantStatus)
			}
			if tc.wantOK && params.interval != tc.wantCanonical {
				t.Errorf("canonical interval = %q, want %q", params.interval, tc.wantCanonical)
			}
			if !tc.wantOK && tc.wantErrorCode != "" {
				var body map[string]any
				if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
					t.Fatalf("response not JSON: %v", err)
				}
				errBlock, _ := body["error"].(map[string]any)
				if errBlock == nil {
					t.Fatalf("response missing error envelope: %s", w.Body.String())
				}
				if got, _ := errBlock["code"].(string); got != tc.wantErrorCode {
					t.Errorf("error code = %q, want %q", got, tc.wantErrorCode)
				}
			}
		})
	}
}

// newTestContext membangun *gin.Context untuk unit-test handler helper.
// Pakai httptest.ResponseRecorder agar response bisa di-inspect.
func newTestContext(target string, query url.Values) (*gin.Context, *httptest.ResponseRecorder) {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)

	req := httptest.NewRequest(http.MethodGet, target, nil)
	if query != nil {
		req.URL.RawQuery = query.Encode()
	}
	c.Request = req
	return c, w
}
