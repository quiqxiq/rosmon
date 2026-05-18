package sse

import "sync"

// Hub adalah registry broker by-topic. Caller (handler/stream.go) panggil
// GetOrCreate untuk dapat broker — kalau topic belum ada, buat baru
// dengan onStart/onStop yang diberikan.
type Hub struct {
	mu      sync.Mutex
	brokers map[string]*Broker
}

// NewHub membuat hub kosong. Thread-safe untuk concurrent access dari
// banyak handler goroutine.
func NewHub() *Hub {
	return &Hub{brokers: make(map[string]*Broker)}
}

// GetOrCreate kembalikan broker untuk topic. Kalau belum ada, buat baru.
// startFn diberi pointer broker yang baru dibuat agar bisa pakai
// b.Publish sebagai handler stream backend.
//
// Catatan: hub memegang broker selamanya (tidak GC). Kalau topic
// dinamis (mis. log:<topics>), hati-hati dengan growth — untuk MVP
// jumlah topic kecil (< 50 unique).
func (h *Hub) GetOrCreate(topic string, startFn func(b *Broker) error, stopFn func()) *Broker {
	h.mu.Lock()
	defer h.mu.Unlock()

	if b, ok := h.brokers[topic]; ok {
		return b
	}
	var b *Broker
	b = NewBroker(topic, func() error { return startFn(b) }, stopFn)
	h.brokers[topic] = b
	return b
}

// Stats mengembalikan dua map per-topic untuk observability:
//   - subscribers: jumlah subscriber aktif per topic (hanya topic dengan
//     subscriber > 0 yang di-include — kurangi noise).
//   - dropped: jumlah event yang di-drop per topic (hanya topic dengan
//     drop > 0 yang di-include — kalau zero, tidak perlu alert).
//
// Dipakai oleh /healthz untuk surface visibility ke operator.
func (h *Hub) Stats() (subscribers map[string]int, dropped map[string]uint64) {
	h.mu.Lock()
	defer h.mu.Unlock()
	subscribers = make(map[string]int, len(h.brokers))
	dropped = make(map[string]uint64, len(h.brokers))
	for topic, b := range h.brokers {
		if n := b.Subscribers(); n > 0 {
			subscribers[topic] = n
		}
		if d := b.DroppedCount(); d > 0 {
			dropped[topic] = d
		}
	}
	return subscribers, dropped
}
