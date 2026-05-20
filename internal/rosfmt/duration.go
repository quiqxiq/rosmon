package rosfmt

import (
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode"
)

// ParseDuration parse format durasi RouterOS ("1w2d3h4m5s", "30d", "1h30m")
// menjadi time.Duration. Tanpa unit dianggap detik. Unit yang didukung:
// "y" (=365d), "mo" (=30d), "w", "d", "h", "m", "s", "ms".
func ParseDuration(v string) (time.Duration, error) {
	v = strings.TrimSpace(v)
	if v == "" {
		return 0, fmt.Errorf("rosfmt: empty duration")
	}
	if _, err := strconv.ParseFloat(v, 64); err == nil {
		secs, _ := strconv.ParseFloat(v, 64)
		return time.Duration(secs * float64(time.Second)), nil
	}
	var total time.Duration
	i := 0
	for i < len(v) {
		j := i
		for j < len(v) && (unicode.IsDigit(rune(v[j])) || v[j] == '.') {
			j++
		}
		if j == i {
			return 0, fmt.Errorf("rosfmt: bad duration %q", v)
		}
		num, err := strconv.ParseFloat(v[i:j], 64)
		if err != nil {
			return 0, fmt.Errorf("rosfmt: bad number %q in duration", v[i:j])
		}
		k := j
		for k < len(v) && unicode.IsLetter(rune(v[k])) {
			k++
		}
		unit := v[j:k]
		mul, ok := durationUnit(unit)
		if !ok {
			return 0, fmt.Errorf("rosfmt: unknown unit %q in duration %q", unit, v)
		}
		total += time.Duration(num * float64(mul))
		i = k
	}
	return total, nil
}

func durationUnit(unit string) (time.Duration, bool) {
	switch unit {
	case "y":
		return 365 * 24 * time.Hour, true
	case "mo":
		return 30 * 24 * time.Hour, true
	case "w":
		return 7 * 24 * time.Hour, true
	case "d":
		return 24 * time.Hour, true
	case "h":
		return time.Hour, true
	case "m":
		return time.Minute, true
	case "s":
		return time.Second, true
	case "ms":
		return time.Millisecond, true
	}
	return 0, false
}

// IsValidDuration cek apakah string bisa di-parse oleh ParseDuration.
func IsValidDuration(v string) bool {
	_, err := ParseDuration(v)
	return err == nil
}

// FormatDuration mengubah time.Duration menjadi string canonical RouterOS-
// style ("1w2d3h4m5s"). Output hanya pakai unit w/d/h/m/s/ms — bukan mo/y
// karena RouterOS native tidak mengenal keduanya (input convenience saja).
//
// d == 0 → "0s". d < 0 → diawali tanda minus.
func FormatDuration(d time.Duration) string {
	if d == 0 {
		return "0s"
	}
	if d < 0 {
		return "-" + FormatDuration(-d)
	}
	units := []struct {
		dur    time.Duration
		suffix string
	}{
		{7 * 24 * time.Hour, "w"},
		{24 * time.Hour, "d"},
		{time.Hour, "h"},
		{time.Minute, "m"},
		{time.Second, "s"},
	}
	var b strings.Builder
	for _, u := range units {
		n := int64(d / u.dur)
		if n > 0 {
			fmt.Fprintf(&b, "%d%s", n, u.suffix)
			d -= time.Duration(n) * u.dur
		}
	}
	if d > 0 {
		ms := int64(d / time.Millisecond)
		if ms > 0 {
			fmt.Fprintf(&b, "%dms", ms)
		}
	}
	if b.Len() == 0 {
		return "0s"
	}
	return b.String()
}

// NormalizeDuration mem-parse v lalu format ulang ke canonical RouterOS-
// style. Berguna untuk normalisasi input campuran ("168h" → "1w", "1y" → "52w1d").
func NormalizeDuration(v string) (string, error) {
	d, err := ParseDuration(v)
	if err != nil {
		return "", err
	}
	return FormatDuration(d), nil
}
