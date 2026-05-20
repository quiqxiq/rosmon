package sse

import (
	"errors"
	"sync"
)

// Sentinel errors untuk Reserve. Caller (handler/stream.go) map ke 429.
var (
	ErrTopicCapExceeded  = errors.New("sse: topic subscriber cap exceeded")
	ErrDeviceCapExceeded = errors.New("sse: device subscriber cap exceeded")
)

// Hub adalah registry broker by-topic. Caller (handler/stream.go) panggil
// GetOrCreate untuk dapat broker — kalau topic belum ada, buat baru
// dengan onStart/onStop yang diberikan.
//
// Hub juga track subscriber count untuk enforce cap:
//   - maxPerTopic: limit subscriber aktif per topic (0 = unlimited).
//   - maxPerDevice: limit subscriber aktif per device id (across topics, 0 = unlimited).
//
// Pakai Reserve sebelum Subscribe untuk cek cap; pakai release callback
// pada defer untuk decrement.
type Hub struct {
	mu             sync.Mutex
	brokers        map[string]*Broker
	perTopicCount  map[string]int
	perDeviceCount map[string]int
	maxPerTopic    int
	maxPerDevice   int
}

// NewHub buat hub kosong tanpa cap (backward-compat).
func NewHub() *Hub { return NewHubWithCaps(0, 0) }

// NewHubWithCaps buat hub dengan cap per-topic dan per-device.
// 0 untuk salah satu = unlimited di dimensi tersebut.
func NewHubWithCaps(maxPerTopic, maxPerDevice int) *Hub {
	if maxPerTopic < 0 {
		maxPerTopic = 0
	}
	if maxPerDevice < 0 {
		maxPerDevice = 0
	}
	return &Hub{
		brokers:        make(map[string]*Broker),
		perTopicCount:  make(map[string]int),
		perDeviceCount: make(map[string]int),
		maxPerTopic:    maxPerTopic,
		maxPerDevice:   maxPerDevice,
	}
}

// Reserve increment counter per-topic dan per-device kalau cap belum
// terlewat. Return release callback yang HARUS dipanggil saat subscriber
// disconnect (idiomatic: pakai defer).
//
// Return ErrTopicCapExceeded / ErrDeviceCapExceeded kalau cap terlewat.
// Handler stream.go map error ini ke HTTP 429 + Retry-After header.
//
// deviceID boleh kosong — tidak akan dihitung di perDeviceCount.
func (h *Hub) Reserve(topic, deviceID string) (release func(), err error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.maxPerTopic > 0 && h.perTopicCount[topic] >= h.maxPerTopic {
		return nil, ErrTopicCapExceeded
	}
	if deviceID != "" && h.maxPerDevice > 0 && h.perDeviceCount[deviceID] >= h.maxPerDevice {
		return nil, ErrDeviceCapExceeded
	}
	h.perTopicCount[topic]++
	if deviceID != "" {
		h.perDeviceCount[deviceID]++
	}
	released := false
	return func() {
		h.mu.Lock()
		defer h.mu.Unlock()
		if released {
			return
		}
		released = true
		if n := h.perTopicCount[topic]; n > 0 {
			h.perTopicCount[topic] = n - 1
			if h.perTopicCount[topic] == 0 {
				delete(h.perTopicCount, topic)
			}
		}
		if deviceID != "" {
			if n := h.perDeviceCount[deviceID]; n > 0 {
				h.perDeviceCount[deviceID] = n - 1
				if h.perDeviceCount[deviceID] == 0 {
					delete(h.perDeviceCount, deviceID)
				}
			}
		}
	}, nil
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

// MaxPerTopic expose configured cap (0 = unlimited). Untuk observability.
func (h *Hub) MaxPerTopic() int { return h.maxPerTopic }

// MaxPerDevice expose configured cap (0 = unlimited).
func (h *Hub) MaxPerDevice() int { return h.maxPerDevice }
