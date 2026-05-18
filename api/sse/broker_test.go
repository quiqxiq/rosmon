package sse

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestBroker_refcountStartStop(t *testing.T) {
	// onStart hanya dipanggil saat subscriber pertama, onStop saat last leave.
	// Idempotent untuk multi subscribe/unsubscribe cycle.
	var starts, stops atomic.Int32
	b := NewBroker("test", func() error { starts.Add(1); return nil }, func() { stops.Add(1) })

	ch1, _ := b.Subscribe("c1")
	if starts.Load() != 1 {
		t.Fatalf("after 1st subscribe: starts=%d, want 1", starts.Load())
	}
	ch2, _ := b.Subscribe("c2")
	if starts.Load() != 1 {
		t.Fatalf("after 2nd subscribe: starts=%d, want still 1", starts.Load())
	}
	if b.Subscribers() != 2 {
		t.Fatalf("Subscribers() = %d, want 2", b.Subscribers())
	}

	b.Unsubscribe("c1")
	if stops.Load() != 0 {
		t.Errorf("after 1st unsubscribe: stops=%d, want still 0", stops.Load())
	}
	b.Unsubscribe("c2")
	if stops.Load() != 1 {
		t.Errorf("after last unsubscribe: stops=%d, want 1", stops.Load())
	}

	// Subscribe lagi → onStart fire lagi
	_, _ = b.Subscribe("c3")
	if starts.Load() != 2 {
		t.Errorf("after re-subscribe: starts=%d, want 2", starts.Load())
	}

	// Cegah unused warning
	_ = ch1
	_ = ch2
}

func TestBroker_publishFanOut(t *testing.T) {
	b := NewBroker("test", func() error { return nil }, func() {})
	ch1, _ := b.Subscribe("c1")
	ch2, _ := b.Subscribe("c2")

	b.Publish(Event{Type: "data", Data: 42})

	for _, ch := range []<-chan Event{ch1, ch2} {
		select {
		case ev := <-ch:
			if ev.Type != "data" || ev.Data != 42 {
				t.Errorf("got %+v, want {data,42}", ev)
			}
		case <-time.After(100 * time.Millisecond):
			t.Error("timeout waiting for fanned-out event")
		}
	}
}

func TestBroker_droppedCount(t *testing.T) {
	b := NewBroker("test", func() error { return nil }, func() {})
	// Subscriber tidak baca channel → buffer 32 akan penuh setelah 32 publish.
	_, _ = b.Subscribe("slow")

	for i := 0; i < 100; i++ {
		b.Publish(Event{Type: "data", Data: i})
	}

	dropped := b.DroppedCount()
	if dropped == 0 {
		t.Fatalf("DroppedCount() = 0, want > 0 (slow subscriber should drop events)")
	}
	// Expectation: 100 - 32 = 68 dropped, tapi cukup verifikasi > 0.
	t.Logf("dropped %d/100 events (expected ~68)", dropped)
}

func TestBroker_publishRaceWithUnsubscribe(t *testing.T) {
	// Stress test: 100 concurrent subscribe/unsubscribe + ribuan publish.
	// Verifikasi tidak ada panic (race close-during-publish di-recover).
	b := NewBroker("test", func() error { return nil }, func() {})

	var wg sync.WaitGroup
	stop := make(chan struct{})

	// Publisher: 1 goroutine spam publish.
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-stop:
				return
			default:
				b.Publish(Event{Type: "x", Data: 1})
			}
		}
	}()

	// 10 worker subscribe/unsubscribe terus-menerus.
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				select {
				case <-stop:
					return
				default:
				}
				ch, _ := b.Subscribe(string(rune('a'+id)) + string(rune('0'+(j%10))))
				// Drain sebagian event biar tidak full.
				select {
				case <-ch:
				default:
				}
				b.Unsubscribe(string(rune('a'+id)) + string(rune('0'+(j%10))))
			}
		}(i)
	}

	// Run selama 200ms lalu stop.
	time.Sleep(200 * time.Millisecond)
	close(stop)
	wg.Wait()

	// Kalau tidak panic, test pass. DroppedCount mungkin > 0 — tidak masalah.
}

func TestHub_stats(t *testing.T) {
	h := NewHub()

	b1 := h.GetOrCreate("topic-a", func(*Broker) error { return nil }, func() {})
	b2 := h.GetOrCreate("topic-b", func(*Broker) error { return nil }, func() {})

	// Topic-a punya 2 subs, topic-b punya 0.
	_, _ = b1.Subscribe("c1")
	_, _ = b1.Subscribe("c2")

	subs, dropped := h.Stats()
	if subs["topic-a"] != 2 {
		t.Errorf("subs[topic-a] = %d, want 2", subs["topic-a"])
	}
	if _, ok := subs["topic-b"]; ok {
		t.Errorf("topic-b should be omitted from subs (0 subscribers)")
	}
	if len(dropped) != 0 {
		t.Errorf("no drops expected, got %v", dropped)
	}

	_ = b2
}
