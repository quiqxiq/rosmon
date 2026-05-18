package workflows

import (
	"errors"
	"strings"
	"testing"

	"github.com/quiqxiq/roslib-mikhmon/domain"
	"github.com/quiqxiq/roslib-mikhmon/mikrotik"
)

func TestValidateVoucherSpec(t *testing.T) {
	t.Parallel()

	base := domain.VoucherSpec{
		BatchSize: 5,
		Length:    8,
		Charset:   domain.CharsetMixNum,
		Profile:   "default",
	}

	cases := []struct {
		name    string
		mutate  func(*domain.VoucherSpec)
		wantErr bool
	}{
		{"valid baseline", func(*domain.VoucherSpec) {}, false},
		{"batch=0 rejected", func(s *domain.VoucherSpec) { s.BatchSize = 0 }, true},
		{"batch=-1 rejected", func(s *domain.VoucherSpec) { s.BatchSize = -1 }, true},
		{"batch=1001 rejected", func(s *domain.VoucherSpec) { s.BatchSize = 1001 }, true},
		{"length=0 rejected", func(s *domain.VoucherSpec) { s.Length = 0 }, true},
		{"length=33 rejected", func(s *domain.VoucherSpec) { s.Length = 33 }, true},
		{"invalid charset rejected", func(s *domain.VoucherSpec) { s.Charset = "nope" }, true},
		{"empty profile rejected", func(s *domain.VoucherSpec) { s.Profile = "" }, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			spec := base
			tc.mutate(&spec)
			err := validateVoucherSpec(spec)
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				if !errors.Is(err, mikrotik.ErrInvalidArgument) {
					t.Errorf("err should wrap ErrInvalidArgument, got %v", err)
				}
			} else if err != nil {
				t.Errorf("unexpected error: %v", err)
			}
		})
	}
}

func TestRandomString(t *testing.T) {
	t.Parallel()

	chars := "abcdef"
	for i := 0; i < 10; i++ {
		s, err := randomString("vc-", 6, chars)
		if err != nil {
			t.Fatalf("err = %v", err)
		}
		if !strings.HasPrefix(s, "vc-") {
			t.Errorf("missing prefix: %q", s)
		}
		body := strings.TrimPrefix(s, "vc-")
		if len(body) != 6 {
			t.Errorf("body length = %d, want 6", len(body))
		}
		for _, r := range body {
			if !strings.ContainsRune(chars, r) {
				t.Errorf("char %q not in set %q", string(r), chars)
			}
		}
	}
}

func TestRandomString_uniqueness(t *testing.T) {
	// Statistical: 8 chars dari 30-char set → 30^8 ≈ 6.5e11 kombinasi.
	// 100 sample tidak boleh ada collision.
	chars := domain.CharsetMixNum.Chars()
	seen := make(map[string]struct{}, 100)
	for i := 0; i < 100; i++ {
		s, err := randomString("", 8, chars)
		if err != nil {
			t.Fatal(err)
		}
		if _, dup := seen[s]; dup {
			t.Fatalf("duplicate %q in 100 samples", s)
		}
		seen[s] = struct{}{}
	}
}

func TestRandomString_emptyChars(t *testing.T) {
	_, err := randomString("", 5, "")
	if err == nil {
		t.Fatal("expected error for empty chars")
	}
}

func TestRandomString_zeroLength(t *testing.T) {
	s, err := randomString("vc-", 0, "abc")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if s != "vc-" {
		t.Errorf("got %q, want %q", s, "vc-")
	}
}

func TestBuildVoucherAddArgs_withValidity(t *testing.T) {
	spec := domain.VoucherSpec{
		Profile:  "vip",
		Server:   "all",
		Validity: "168h", // 7 days
		Comment:  "VIP",
	}
	args, err := buildVoucherAddArgs(spec, "user1", "pass1")
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if args.Name != "user1" || args.Password != "pass1" {
		t.Errorf("name/password mismatch: %+v", args)
	}
	if args.Profile != "vip" || args.Server != "all" {
		t.Errorf("profile/server: %+v", args)
	}
	// Comment harus berisi expiry stamp (format mikhmon) di depan + " VIP".
	// Cek pakai prefix lowercase month + delimiter "/".
	if !strings.HasSuffix(args.Comment, " VIP") {
		t.Errorf("comment should suffix ' VIP': %q", args.Comment)
	}
	// First 20 chars adalah expiry timestamp.
	if len(args.Comment) < 20 {
		t.Fatalf("comment too short: %q", args.Comment)
	}
	if !strings.Contains(args.Comment[:20], "/") {
		t.Errorf("expiry stamp not embedded: %q", args.Comment[:20])
	}
}

func TestBuildVoucherAddArgs_invalidValidity(t *testing.T) {
	spec := domain.VoucherSpec{
		Profile:  "vip",
		Validity: "1week", // invalid Go duration
	}
	_, err := buildVoucherAddArgs(spec, "u", "p")
	if !errors.Is(err, mikrotik.ErrInvalidArgument) {
		t.Errorf("err = %v, want wrap ErrInvalidArgument", err)
	}
}

func TestBuildVoucherAddArgs_noValidity(t *testing.T) {
	spec := domain.VoucherSpec{
		Profile: "vip",
		Comment: "no-expiry",
	}
	args, err := buildVoucherAddArgs(spec, "u", "p")
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	if args.Comment != "no-expiry" {
		t.Errorf("comment should not be modified: %q", args.Comment)
	}
}
