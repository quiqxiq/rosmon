// Package ratelimit menyediakan token-bucket rate limiter per-key dengan
// TTL eviction. Backbone: golang.org/x/time/rate.
//
// Usage:
//
//	lim := ratelimit.New(60.0/60, 60, 10*time.Minute) // 1 rps, burst 60
//	allowed, retryAfter := lim.Allow("user-42")
//	if !allowed {
//	    w.Header().Set("Retry-After", strconv.Itoa(int(retryAfter.Seconds())))
//	    w.WriteHeader(429)
//	    return
//	}
//
// Single-instance / in-memory — kalau scale-out multi-instance, ganti
// backend ke Redis token-bucket.
package ratelimit

import (
	"sync"
	"time"

	"golang.org/x/time/rate"
)

// KeyedLimiter agregasi *rate.Limiter per-key dengan eviction TTL.
type KeyedLimiter struct {
	rps     rate.Limit
	burst   int
	ttl     time.Duration
	now     func() time.Time

	mu      sync.Mutex
	entries map[string]*entry
	closeCh chan struct{}
	closed  bool
}

type entry struct {
	lim      *rate.Limiter
	lastSeen time.Time
}

// New buat KeyedLimiter. rps = token per second (mis. 1.0 = 1 req/s).
// burst = max token burst. ttl = idle eviction threshold (entry yang
// tidak ter-akses > ttl di-purge oleh background goroutine).
//
// Eviction goroutine berhenti saat Close() dipanggil.
func New(rps float64, burst int, ttl time.Duration) *KeyedLimiter {
	if rps <= 0 {
		rps = 1
	}
	if burst <= 0 {
		burst = 1
	}
	if ttl <= 0 {
		ttl = 10 * time.Minute
	}
	l := &KeyedLimiter{
		rps:     rate.Limit(rps),
		burst:   burst,
		ttl:     ttl,
		now:     time.Now,
		entries: make(map[string]*entry),
		closeCh: make(chan struct{}),
	}
	go l.evictionLoop()
	return l
}

// Allow cek apakah request dari key boleh lanjut. Return (true, 0) kalau
// allowed; (false, waitDuration) kalau di-throttle (Retry-After hint).
func (l *KeyedLimiter) Allow(key string) (bool, time.Duration) {
	l.mu.Lock()
	e, ok := l.entries[key]
	if !ok {
		e = &entry{lim: rate.NewLimiter(l.rps, l.burst)}
		l.entries[key] = e
	}
	e.lastSeen = l.now()
	l.mu.Unlock()

	reservation := e.lim.Reserve()
	if !reservation.OK() {
		// Tidak akan terjadi dengan burst > 0, tapi guard saja.
		return false, time.Second
	}
	wait := reservation.Delay()
	if wait > 0 {
		reservation.Cancel()
		return false, wait
	}
	return true, 0
}

// Close stop eviction goroutine. Aman dipanggil sekali.
func (l *KeyedLimiter) Close() {
	l.mu.Lock()
	if l.closed {
		l.mu.Unlock()
		return
	}
	l.closed = true
	close(l.closeCh)
	l.mu.Unlock()
}

// Size return jumlah entry aktif (untuk observability).
func (l *KeyedLimiter) Size() int {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.entries)
}

func (l *KeyedLimiter) evictionLoop() {
	interval := l.ttl / 2
	if interval < 30*time.Second {
		interval = 30 * time.Second
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-l.closeCh:
			return
		case <-ticker.C:
			l.evict()
		}
	}
}

func (l *KeyedLimiter) evict() {
	cutoff := l.now().Add(-l.ttl)
	l.mu.Lock()
	defer l.mu.Unlock()
	for k, e := range l.entries {
		if e.lastSeen.Before(cutoff) {
			delete(l.entries, k)
		}
	}
}
