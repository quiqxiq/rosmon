package config

import (
	"strconv"
	"strings"
)

// RateLimitConfig mengontrol rate limit REST & SSE subscriber cap.
type RateLimitConfig struct {
	UserRPM         int // limit per JWT subject, req/menit (default 60)
	IPRPM           int // limit per IP untuk endpoint anon (default 20)
	HeavyRPM        int // limit per user untuk endpoint mahal (default 10)
	SSEMaxPerTopic  int // cap subscriber per topic SSE (default 20)
	SSEMaxPerDevice int // cap subscriber per device (across topics) (default 50)
}

// LoadRateLimitFromEnv baca env RATE_LIMIT_* dan SSE_MAX_*. Nilai 0 atau
// negatif → fallback ke default.
func LoadRateLimitFromEnv() *RateLimitConfig {
	return &RateLimitConfig{
		UserRPM:         getenvInt("RATE_LIMIT_USER_RPM", 60),
		IPRPM:           getenvInt("RATE_LIMIT_IP_RPM", 20),
		HeavyRPM:        getenvInt("RATE_LIMIT_HEAVY_RPM", 10),
		SSEMaxPerTopic:  getenvInt("SSE_MAX_PER_TOPIC", 20),
		SSEMaxPerDevice: getenvInt("SSE_MAX_PER_DEVICE", 50),
	}
}

func getenvInt(key string, def int) int {
	v := strings.TrimSpace(getenv(key, ""))
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return def
	}
	return n
}
