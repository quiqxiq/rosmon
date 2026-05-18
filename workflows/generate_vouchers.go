package workflows

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/quiqxiq/roslib-mikhmon/domain"
	"github.com/quiqxiq/roslib-mikhmon/mikrotik"
	"github.com/quiqxiq/roslib-mikhmon/mikrotik/hotspot"
)

// GeneratedVoucher adalah hasil 1 voucher yang berhasil di-create di
// RouterOS. ID dipakai oleh caller untuk operasi follow-up (delete,
// update, dst).
type GeneratedVoucher struct {
	ID       string
	Username string
	Password string
}

// GenerateVouchersErr adalah aggregated error untuk batch generate.
// Berisi voucher yang sudah berhasil dibuat sebelum gagal — caller bisa
// lanjut atau rollback secara eksplisit.
type GenerateVouchersErr struct {
	Created []GeneratedVoucher
	Failed  error
}

func (e *GenerateVouchersErr) Error() string {
	return fmt.Sprintf("workflows.GenerateVouchers: created=%d, failed: %v",
		len(e.Created), e.Failed)
}

func (e *GenerateVouchersErr) Unwrap() error { return e.Failed }

// GenerateVouchers membuat sejumlah voucher hotspot berdasarkan spec.
// Setiap voucher unique (username + password generated dari charset).
//
// Algoritma:
//
//  1. Validate spec (Length > 0, BatchSize > 0, Charset valid, Profile
//     non-empty).
//  2. Loop BatchSize kali:
//     a. Generate username = Prefix + random(Length) dari Charset.
//     b. Generate password (UserMode="vc" → password sama dengan
//     username; default → password baru random Length).
//     c. Build hotspot.UserAddArgs dari spec + comment expiry kalau
//     Validity di-set (format mikhmon "jan/02/2006 15:04:05").
//     d. Call c.Hotspot.UserAdd. Kalau gagal, return GenerateVouchersErr
//     dengan voucher yang sudah berhasil.
//  3. Return slice GeneratedVoucher.
//
// Validity dihitung dari time.Now()+ParseDuration(Validity). Format
// duration mengikuti Go (mis. "168h" untuk 7 hari) — RouterOS-style
// "7d" tidak didukung di sini (caller convert dulu).
func GenerateVouchers(ctx context.Context, c *Clients, spec domain.VoucherSpec) ([]GeneratedVoucher, error) {
	if err := validateVoucherSpec(spec); err != nil {
		return nil, err
	}

	chars := spec.Charset.Chars()
	out := make([]GeneratedVoucher, 0, spec.BatchSize)

	for i := 0; i < spec.BatchSize; i++ {
		if err := ctx.Err(); err != nil {
			return out, err
		}

		username, err := randomString(spec.Prefix, spec.Length, chars)
		if err != nil {
			return out, &GenerateVouchersErr{Created: out, Failed: err}
		}

		// UserMode "vc" (voucher code) → password sama dengan username.
		// Default "up" (user/pass) → password unik.
		password := username
		if spec.UserMode != "vc" {
			password, err = randomString("", spec.Length, chars)
			if err != nil {
				return out, &GenerateVouchersErr{Created: out, Failed: err}
			}
		}

		args, err := buildVoucherAddArgs(spec, username, password)
		if err != nil {
			return out, &GenerateVouchersErr{Created: out, Failed: err}
		}

		id, err := c.Hotspot.UserAdd(ctx, args)
		if err != nil {
			return out, &GenerateVouchersErr{Created: out, Failed: fmt.Errorf("UserAdd %q: %w", username, err)}
		}

		out = append(out, GeneratedVoucher{ID: id, Username: username, Password: password})
	}
	return out, nil
}

// validateVoucherSpec memastikan field minimum terisi.
func validateVoucherSpec(spec domain.VoucherSpec) error {
	if spec.BatchSize <= 0 {
		return fmt.Errorf("%w: batch_size must be > 0", mikrotik.ErrInvalidArgument)
	}
	if spec.BatchSize > 1000 {
		return fmt.Errorf("%w: batch_size capped at 1000", mikrotik.ErrInvalidArgument)
	}
	if spec.Length <= 0 || spec.Length > 32 {
		return fmt.Errorf("%w: length must be in (0, 32]", mikrotik.ErrInvalidArgument)
	}
	if !spec.Charset.IsValid() {
		return fmt.Errorf("%w: invalid charset %q", mikrotik.ErrInvalidArgument, spec.Charset)
	}
	if spec.Charset.Chars() == "" {
		return fmt.Errorf("%w: empty character set", mikrotik.ErrInvalidArgument)
	}
	if spec.Profile == "" {
		return fmt.Errorf("%w: profile required", mikrotik.ErrInvalidArgument)
	}
	return nil
}

// buildVoucherAddArgs translate spec+username+password ke UserAddArgs.
// Comment expiry di-attach kalau Validity terisi.
func buildVoucherAddArgs(spec domain.VoucherSpec, username, password string) (hotspot.UserAddArgs, error) {
	args := hotspot.UserAddArgs{
		Name:            username,
		Password:        password,
		Profile:         spec.Profile,
		Server:          spec.Server,
		LimitUptime:     spec.TimeLimit,
		LimitBytesTotal: spec.DataLimit,
		Comment:         spec.Comment,
	}
	if spec.Validity != "" {
		dur, err := time.ParseDuration(spec.Validity)
		if err != nil {
			return args, fmt.Errorf("%w: invalid validity %q: %v", mikrotik.ErrInvalidArgument, spec.Validity, err)
		}
		if dur > 0 {
			// Mikhmon format: "jan/02/2006 15:04:05" (lowercase month).
			// Pakai layout "Jan" supaya bulan berubah sesuai date.
			expiry := time.Now().Add(dur)
			stamp := strings.ToLower(expiry.Format("Jan/02/2006 15:04:05"))
			if args.Comment == "" {
				args.Comment = stamp
			} else {
				args.Comment = stamp + " " + args.Comment
			}
		}
	}
	return args, nil
}

// randomString membangun string panjang n dari rune set chars dengan
// prefix opsional. Pakai crypto/rand untuk audit-friendly randomness.
func randomString(prefix string, n int, chars string) (string, error) {
	if chars == "" {
		return "", errors.New("randomString: empty chars")
	}
	if n <= 0 {
		return prefix, nil
	}
	runes := []rune(chars)
	max := big.NewInt(int64(len(runes)))

	var b strings.Builder
	b.Grow(len(prefix) + n)
	b.WriteString(prefix)
	for i := 0; i < n; i++ {
		idx, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", fmt.Errorf("randomString: rand.Int: %w", err)
		}
		b.WriteRune(runes[idx.Int64()])
	}
	return b.String(), nil
}
