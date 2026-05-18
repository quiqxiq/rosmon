// Package sse menyediakan adapter Server-Sent Events di atas streaming
// roslib. Pola: 1 broker per topic (mis. "hotspot-active") yang fan-out
// event ke semua subscriber SSE client. Broker auto-start backend stream
// roslib saat subscriber pertama, auto-stop saat last subscriber leave.
package sse

import (
	"sync"
	"sync/atomic"
)

// Event adalah satu payload yang dikirim ke SSE client. Type = nama event
// SSE (mis. "change", "log", "resource"). Data di-marshal JSON di writer.
type Event struct {
	Type string
	Data any
	ID   string // optional, untuk SSE Last-Event-ID resume
}

// Broker mengelola fan-out event dari satu backend stream (roslib) ke
// banyak SSE client. Refcount via len(subs): subscriber pertama trigger
// onStart, last unsubscribe trigger onStop.
type Broker struct {
	Topic string

	onStart func() error
	onStop  func()

	mu      sync.Mutex
	subs    map[string]chan Event
	started bool

	// dropped menghitung event yang di-drop karena subscriber channel penuh.
	// Visibility ke operator via Hub.Stats / /healthz untuk detect slow client.
	dropped atomic.Uint64
}

// NewBroker membuat broker baru. onStart dipanggil saat subscriber pertama
// register; biasanya buka stream roslib (mis. hot.ActiveStream(topic, b.Publish)).
// onStop dipanggil saat last subscriber unsubscribe; biasanya tutup stream
// (mis. hot.StopActiveStream(topic)).
func NewBroker(topic string, onStart func() error, onStop func()) *Broker {
	return &Broker{
		Topic:   topic,
		onStart: onStart,
		onStop:  onStop,
		subs:    make(map[string]chan Event),
	}
}

// Subscribe register clientID. Channel buffer 32 — kalau handler lambat,
// event yang melebihi buffer di-drop oleh Publish (lihat doc Publish).
// Kalau ini subscriber pertama, panggil onStart; error onStart diteruskan
// dan client tidak ter-register.
func (b *Broker) Subscribe(clientID string) (<-chan Event, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if !b.started {
		if err := b.onStart(); err != nil {
			return nil, err
		}
		b.started = true
	}
	ch := make(chan Event, 32)
	b.subs[clientID] = ch
	return ch, nil
}

// Unsubscribe remove clientID dari map. Kalau ini last subscriber,
// trigger onStop. Idempotent: clientID yang sudah tidak ada di-skip.
//
// Channel TIDAK di-close — caller (writer.Stream) sudah selesai baca
// channel saat memanggil Unsubscribe via defer, jadi tidak ada reader
// lain yang menunggu signal close. Channel akan di-GC otomatis setelah
// snapshot di Publish in-flight selesai.
//
// Rationale: close-during-publish menghasilkan race detector warning
// meskipun recover() menangkap panic — race adalah read+write tanpa
// sync, bukan crash. Hilangkan close() untuk benar-benar race-free.
func (b *Broker) Unsubscribe(clientID string) {
	b.mu.Lock()
	defer b.mu.Unlock()

	delete(b.subs, clientID)
	if len(b.subs) == 0 && b.started {
		b.onStop()
		b.started = false
	}
}

// Publish fan-out event ke semua subscriber. Non-blocking: kalau channel
// subscriber penuh (32 event tertunggak), event di-drop untuk subscriber
// itu — supaya satu slow client tidak block publisher (router stream).
//
// Implementasi snapshot subs di-lock lalu publish unlocked supaya
// throughput tinggi (publisher = router stream goroutine) tidak
// terhambat oleh select{} per-channel saat ada banyak subscriber.
// Snapshot aman karena Unsubscribe tidak close channel — slot yang
// sudah keluar dari map masih bisa menerima send (buffered, lalu drop).
func (b *Broker) Publish(e Event) {
	b.mu.Lock()
	snap := make([]chan Event, 0, len(b.subs))
	for _, ch := range b.subs {
		snap = append(snap, ch)
	}
	b.mu.Unlock()

	for _, ch := range snap {
		select {
		case ch <- e:
		default:
			b.dropped.Add(1)
		}
	}
}

// Subscribers mengembalikan jumlah subscriber aktif. Berguna untuk logging
// & test.
func (b *Broker) Subscribers() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.subs)
}

// DroppedCount mengembalikan total event yang di-drop karena subscriber
// channel penuh. Monotonic counter — caller bisa hitung delta sendiri.
func (b *Broker) DroppedCount() uint64 {
	return b.dropped.Load()
}
