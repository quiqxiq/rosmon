package expiry

import (
	"testing"
	"time"
)

func TestParseExpiry(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		comment string
		wantOK  bool
		want    time.Time
	}{
		{
			name:    "valid lowercase month",
			comment: "jan/05/2025 15:04:05",
			wantOK:  true,
			want:    time.Date(2025, 1, 5, 15, 4, 5, 0, time.UTC),
		},
		{
			name:    "valid with trailing text",
			comment: "dec/31/2025 23:59:59 - VIP user",
			wantOK:  true,
			want:    time.Date(2025, 12, 31, 23, 59, 59, 0, time.UTC),
		},
		{
			name:    "valid with leading whitespace",
			comment: "   feb/14/2026 08:00:00",
			wantOK:  true,
			want:    time.Date(2026, 2, 14, 8, 0, 0, 0, time.UTC),
		},
		{
			name:    "too short",
			comment: "jan/05/2025 15:04",
			wantOK:  false,
		},
		{
			name:    "empty",
			comment: "",
			wantOK:  false,
		},
		{
			name:    "invalid month",
			comment: "xyz/05/2025 15:04:05",
			wantOK:  false,
		},
		{
			name:    "invalid format separator",
			comment: "jan-05-2025 15:04:05",
			wantOK:  false,
		},
		{
			name:    "uppercase month accepted (Go time.Parse case-insensitive)",
			comment: "JAN/05/2025 15:04:05",
			wantOK:  true,
			want:    time.Date(2025, 1, 5, 15, 4, 5, 0, time.UTC),
		},
		{
			name:    "titlecase month accepted",
			comment: "Jan/05/2025 15:04:05",
			wantOK:  true,
			want:    time.Date(2025, 1, 5, 15, 4, 5, 0, time.UTC),
		},
		{
			name:    "non-date comment",
			comment: "ini bukan tanggal mikhmon",
			wantOK:  false,
		},
		{
			name:    "exactly 20 chars valid",
			comment: "jan/01/2025 00:00:00",
			wantOK:  true,
			want:    time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, ok := ParseExpiry(tc.comment)
			if ok != tc.wantOK {
				t.Fatalf("ParseExpiry(%q) ok = %v, want %v", tc.comment, ok, tc.wantOK)
			}
			if ok && !got.Equal(tc.want) {
				t.Errorf("ParseExpiry(%q) = %v, want %v", tc.comment, got, tc.want)
			}
		})
	}
}
