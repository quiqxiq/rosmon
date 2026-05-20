package ratelimit

import (
	"sync"
	"testing"
	"time"
)

func TestKeyedLimiter_allowBurst(t *testing.T) {
	t.Parallel()
	l := New(1, 5, time.Minute) // 1 rps, burst 5
	t.Cleanup(l.Close)

	for i := 0; i < 5; i++ {
		ok, _ := l.Allow("user-1")
		if !ok {
			t.Errorf("burst %d: expected allowed", i)
		}
	}
	ok, wait := l.Allow("user-1")
	if ok {
		t.Errorf("burst exceeded should be rejected")
	}
	if wait <= 0 {
		t.Errorf("retry-after should be positive, got %v", wait)
	}
}

func TestKeyedLimiter_perKeyIndependent(t *testing.T) {
	t.Parallel()
	l := New(1, 2, time.Minute)
	t.Cleanup(l.Close)

	for i := 0; i < 2; i++ {
		ok, _ := l.Allow("user-a")
		if !ok {
			t.Fatalf("user-a burst %d rejected", i)
		}
	}
	// user-a habis quota
	if ok, _ := l.Allow("user-a"); ok {
		t.Errorf("user-a 3rd should be rejected")
	}
	// user-b masih punya quota penuh
	for i := 0; i < 2; i++ {
		if ok, _ := l.Allow("user-b"); !ok {
			t.Errorf("user-b burst %d rejected", i)
		}
	}
}

func TestKeyedLimiter_eviction(t *testing.T) {
	t.Parallel()
	l := New(1, 1, time.Minute)
	t.Cleanup(l.Close)

	// Inject custom clock untuk simulasi waktu lewat TTL.
	base := time.Now()
	l.now = func() time.Time { return base }

	l.Allow("temp-key")
	if l.Size() != 1 {
		t.Fatalf("size = %d, want 1", l.Size())
	}

	// Maju waktu > TTL → entry harus ter-evict saat evict() dipanggil.
	l.now = func() time.Time { return base.Add(2 * time.Minute) }
	l.evict()

	if l.Size() != 0 {
		t.Errorf("after eviction size = %d, want 0", l.Size())
	}
}

func TestKeyedLimiter_concurrent(t *testing.T) {
	t.Parallel()
	l := New(100, 100, time.Minute)
	t.Cleanup(l.Close)

	var wg sync.WaitGroup
	const workers = 20
	wg.Add(workers)
	for i := 0; i < workers; i++ {
		go func(idx int) {
			defer wg.Done()
			for j := 0; j < 50; j++ {
				l.Allow("shared-key")
			}
		}(i)
	}
	wg.Wait()
	// Tidak race; semua workers selesai tanpa panic.
}

func TestKeyedLimiter_Close_idempotent(t *testing.T) {
	t.Parallel()
	l := New(1, 1, time.Minute)
	l.Close()
	l.Close() // double-close must not panic
}
