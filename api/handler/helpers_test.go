package handler

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/quiqxiq/rosmon/mikrotik"
)

func TestMapError(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name       string
		err        error
		wantCode   string
		wantStatus int
	}{
		{"nil → OK", nil, "OK", http.StatusOK},
		{"ErrNotFound → 404", mikrotik.ErrNotFound, "NOT_FOUND", http.StatusNotFound},
		{"ErrInvalidArgument → 400", mikrotik.ErrInvalidArgument, "INVALID_ARGUMENT", http.StatusBadRequest},
		{"ErrAmbiguous → 409", mikrotik.ErrAmbiguous, "AMBIGUOUS", http.StatusConflict},
		{"context.DeadlineExceeded → 504", context.DeadlineExceeded, "TIMEOUT", http.StatusGatewayTimeout},
		{"context.Canceled → 499", context.Canceled, "CANCELED", 499},
		{"unknown → 500", errors.New("boom"), "INTERNAL", http.StatusInternalServerError},
		{"wrapped ErrNotFound → 404", fmt.Errorf("lookup: %w", mikrotik.ErrNotFound), "NOT_FOUND", http.StatusNotFound},
		{"wrapped ErrInvalidArgument → 400", fmt.Errorf("bad input: %w", mikrotik.ErrInvalidArgument), "INVALID_ARGUMENT", http.StatusBadRequest},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			code, status, _ := MapError(tc.err)
			if code != tc.wantCode {
				t.Errorf("code = %q, want %q", code, tc.wantCode)
			}
			if status != tc.wantStatus {
				t.Errorf("status = %d, want %d", status, tc.wantStatus)
			}
		})
	}
}
