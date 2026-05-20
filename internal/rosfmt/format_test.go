package rosfmt

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDateInt(t *testing.T) {
	tests := []struct {
		in   string
		want int
	}{
		{"jan/05/2025", 20250105},
		{"feb/29/2024", 20240229},
		{"dec/31/2099", 20991231},
		{"oct/01/1970", 19701001},
	}
	for _, tt := range tests {
		got, err := DateInt(tt.in)
		require.NoError(t, err, tt.in)
		assert.Equal(t, tt.want, got, tt.in)
	}
}

func TestDateInt_Errors(t *testing.T) {
	for _, in := range []string{"", "xyz/01/2025", "jan/xx/2025", "short"} {
		_, err := DateInt(in)
		assert.Error(t, err, in)
	}
}

func TestTimeMinutes(t *testing.T) {
	tests := []struct {
		in   string
		want int
	}{
		{"00:00:00", 0},
		{"01:30:00", 90},
		{"23:59:59", 23*60 + 59},
		{"12:00", 12 * 60},
	}
	for _, tt := range tests {
		got, err := TimeMinutes(tt.in)
		require.NoError(t, err, tt.in)
		assert.Equal(t, tt.want, got, tt.in)
	}
}

func TestFormatDate_RoundTrip(t *testing.T) {
	t0 := time.Date(2025, 1, 5, 0, 0, 0, 0, time.UTC)
	s := FormatDate(t0)
	assert.Equal(t, "jan/05/2025", s)
	parsed, err := ParseDate(s, time.UTC)
	require.NoError(t, err)
	assert.Equal(t, t0, parsed)
}

func TestCurrentMonthOwner(t *testing.T) {
	t0 := time.Date(2025, 3, 15, 0, 0, 0, 0, time.UTC)
	assert.Equal(t, "Mar2025", CurrentMonthOwner(t0))
}

func TestParseDuration(t *testing.T) {
	tests := []struct {
		in   string
		want time.Duration
	}{
		{"30s", 30 * time.Second},
		{"5m", 5 * time.Minute},
		{"1h", time.Hour},
		{"1d", 24 * time.Hour},
		{"1w", 7 * 24 * time.Hour},
		{"1w2d3h", 7*24*time.Hour + 2*24*time.Hour + 3*time.Hour},
		{"30", 30 * time.Second},                                            // tanpa unit
		{"1mo", 30 * 24 * time.Hour},                                        // bulan = 30 hari
		{"1y", 365 * 24 * time.Hour},                                        // tahun = 365 hari
		{"1mo15d", 45 * 24 * time.Hour},                                     // mixed mo + d
		{"1h30m", 90 * time.Minute},                                         // mixed h + m
		{"1w2d3h4m5s", 7*24*time.Hour + 2*24*time.Hour + 3*time.Hour + 4*time.Minute + 5*time.Second},
		{"100ms", 100 * time.Millisecond},
	}
	for _, tt := range tests {
		got, err := ParseDuration(tt.in)
		require.NoError(t, err, tt.in)
		assert.Equal(t, tt.want, got, tt.in)
	}
}

func TestParseDuration_Errors(t *testing.T) {
	for _, in := range []string{"", "abc", "1x", "1h2x", "1week"} {
		_, err := ParseDuration(in)
		assert.Error(t, err, in)
	}
}

func TestIsValidDuration(t *testing.T) {
	assert.True(t, IsValidDuration("1d"))
	assert.True(t, IsValidDuration("1mo"))
	assert.True(t, IsValidDuration("1y"))
	assert.False(t, IsValidDuration("xyz"))
}

func TestFormatDuration(t *testing.T) {
	tests := []struct {
		in   time.Duration
		want string
	}{
		{0, "0s"},
		{30 * time.Second, "30s"},
		{time.Minute, "1m"},
		{time.Hour, "1h"},
		{24 * time.Hour, "1d"},
		{7 * 24 * time.Hour, "1w"},
		{8 * 24 * time.Hour, "1w1d"},
		{90 * time.Minute, "1h30m"},
		{25 * time.Hour, "1d1h"},
		{30 * 24 * time.Hour, "4w2d"},   // 30d bukan "1mo" karena output drop mo/y
		{365 * 24 * time.Hour, "52w1d"}, // 1y → 52w1d
		{7*24*time.Hour + 2*24*time.Hour + 3*time.Hour + 4*time.Minute + 5*time.Second, "1w2d3h4m5s"},
		{500 * time.Millisecond, "500ms"},
		{-30 * time.Second, "-30s"},
	}
	for _, tt := range tests {
		got := FormatDuration(tt.in)
		assert.Equal(t, tt.want, got, tt.in.String())
	}
}

func TestFormatDuration_RoundTrip(t *testing.T) {
	durations := []time.Duration{
		time.Minute,
		time.Hour,
		25 * time.Hour,
		7 * 24 * time.Hour,
		30 * 24 * time.Hour,
		365 * 24 * time.Hour,
		7*24*time.Hour + 2*24*time.Hour + 3*time.Hour + 4*time.Minute + 5*time.Second,
	}
	for _, d := range durations {
		s := FormatDuration(d)
		parsed, err := ParseDuration(s)
		require.NoError(t, err, s)
		assert.Equal(t, d, parsed, "roundtrip mismatch for %s → %q", d, s)
	}
}

func TestNormalizeDuration(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{"168h", "1w"},
		{"7d", "1w"},
		{"1y", "52w1d"},
		{"1mo", "4w2d"},
		{"30", "30s"},
		{"1h30m", "1h30m"},
	}
	for _, tt := range tests {
		got, err := NormalizeDuration(tt.in)
		require.NoError(t, err, tt.in)
		assert.Equal(t, tt.want, got, tt.in)
	}
}

func TestNormalizeDuration_invalid(t *testing.T) {
	_, err := NormalizeDuration("1week")
	assert.Error(t, err)
}

func TestEscapeScriptString(t *testing.T) {
	tests := []struct {
		in   string
		want string
	}{
		{`hello`, `hello`},
		{`a"b`, `a\"b`},
		{`a\b`, `a\\b`},
		{`$user`, `\$user`},
		{"line1\nline2", `line1\nline2`},
		{`\"$x"`, `\\\"\$x\"`},
	}
	for _, tt := range tests {
		got := EscapeScriptString(tt.in)
		assert.Equal(t, tt.want, got, tt.in)
	}
}

func TestQuoteScriptString(t *testing.T) {
	assert.Equal(t, `"hello"`, QuoteScriptString("hello"))
	assert.Equal(t, `"a\"b"`, QuoteScriptString(`a"b`))
}
