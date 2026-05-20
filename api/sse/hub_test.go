package sse

import (
	"errors"
	"sync"
	"testing"
)

func TestHub_Reserve_unlimited(t *testing.T) {
	t.Parallel()
	h := NewHub() // no caps
	for i := 0; i < 100; i++ {
		release, err := h.Reserve("topic-a", "device-1")
		if err != nil {
			t.Fatalf("iter %d: unexpected err %v", i, err)
		}
		release()
	}
}

func TestHub_Reserve_perTopicCap(t *testing.T) {
	t.Parallel()
	h := NewHubWithCaps(3, 0)

	releases := make([]func(), 0, 3)
	for i := 0; i < 3; i++ {
		release, err := h.Reserve("topic-a", "")
		if err != nil {
			t.Fatalf("iter %d: %v", i, err)
		}
		releases = append(releases, release)
	}
	// 4th reservation → ErrTopicCapExceeded
	_, err := h.Reserve("topic-a", "")
	if !errors.Is(err, ErrTopicCapExceeded) {
		t.Errorf("err = %v, want ErrTopicCapExceeded", err)
	}
	// Topic lain masih ok
	rel2, err := h.Reserve("topic-b", "")
	if err != nil {
		t.Errorf("topic-b err = %v", err)
	}
	if rel2 != nil {
		rel2()
	}
	// Release satu slot di topic-a → slot baru bisa
	releases[0]()
	rel3, err := h.Reserve("topic-a", "")
	if err != nil {
		t.Errorf("after release: err = %v", err)
	}
	if rel3 != nil {
		rel3()
	}
}

func TestHub_Reserve_perDeviceCap(t *testing.T) {
	t.Parallel()
	h := NewHubWithCaps(0, 2)

	rel1, err := h.Reserve("topic-a", "dev-1")
	if err != nil {
		t.Fatalf("1: %v", err)
	}
	rel2, err := h.Reserve("topic-b", "dev-1") // berbeda topic, sama device
	if err != nil {
		t.Fatalf("2: %v", err)
	}
	// 3rd dengan device sama → cap
	_, err = h.Reserve("topic-c", "dev-1")
	if !errors.Is(err, ErrDeviceCapExceeded) {
		t.Errorf("err = %v, want ErrDeviceCapExceeded", err)
	}
	// Device beda → ok
	rel4, err := h.Reserve("topic-c", "dev-2")
	if err != nil {
		t.Errorf("dev-2: %v", err)
	}
	rel1()
	rel2()
	if rel4 != nil {
		rel4()
	}
}

func TestHub_Reserve_release_idempotent(t *testing.T) {
	t.Parallel()
	h := NewHubWithCaps(1, 0)
	release, err := h.Reserve("topic-x", "d")
	if err != nil {
		t.Fatal(err)
	}
	release()
	release() // second call → noop, no panic
	// Sekarang slot bebas lagi
	rel2, err := h.Reserve("topic-x", "d")
	if err != nil {
		t.Errorf("after double-release: %v", err)
	}
	rel2()
}

func TestHub_Reserve_concurrent(t *testing.T) {
	t.Parallel()
	h := NewHubWithCaps(10, 0)

	var wg sync.WaitGroup
	var success int64
	var mu sync.Mutex
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if rel, err := h.Reserve("topic-c", "d"); err == nil {
				mu.Lock()
				success++
				mu.Unlock()
				rel()
			}
		}()
	}
	wg.Wait()
	// Concurrent reserve+release: setiap goroutine yang sukses harus
	// release segera, jadi tidak ada cap exceeded (sequential check)
	// — atau setidaknya tidak crash.
	t.Logf("success = %d / 50", success)
}
