// Package netstream menyatukan SATU stream per resource (queue, interface)
// per device sebagai sumber tunggal untuk: (1) live SSE (semua view ter-filter
// di Go), dan (2) penulisan historis ke InfluxDB. Tidak ada poll — memakai
// streaming RouterOS (`print stats interval=` & monitor) via roslib.
//
// Producer dibuat sekali per (device,interval) lewat sse.Hub.GetOrCreate;
// SSE handler & writer Influx sama-sama "menumpang" stream itu. Saat Influx
// aktif, Manager menahan satu subscriber permanen per device agar stream tetap
// hidup walau tidak ada penonton (supaya historis terus terisi).
package netstream

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	influxdb3 "github.com/InfluxCommunity/influxdb3-go/v2/influxdb3"
	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/api/sse"
	"github.com/quiqxiq/rosmon/mikrotik/network"
	"github.com/sirupsen/logrus"
)

// LiveInterval = cadence stream live + historis (RouterOS push tiap interval ini).
const LiveInterval = time.Second

// Manager memiliki Hub + (opsional) client Influx.
type Manager struct {
	hub    *sse.Hub
	influx *influxdb3.Client // nil = historis nonaktif
	log    *logrus.Logger

	mu        sync.Mutex
	keepalive map[uint][]func() // per-device unsubscribe funcs (keep-alive Influx)

	// points = buffer tulis Influx asinkron. KRUSIAL: penulisan Influx TIDAK
	// boleh blok di dalam handler stream (consume goroutine). go-routeros async
	// memakai SATU reader goroutine yang mem-feed semua listener channel; bila
	// handler blok di WritePoints (sync), reader ikut stall → SEMUA stream
	// (queue+interface+metrics) starve jadi sparse. Maka writeQueue/writeInterface
	// hanya meng-enqueue (non-blocking, drop bila penuh), goroutine writer yang
	// batch-flush ke Influx di luar jalur stream.
	points chan *influxdb3.Point
}

const influxBufSize = 4096

func New(hub *sse.Hub, influx *influxdb3.Client, log *logrus.Logger) *Manager {
	if log == nil {
		log = logrus.New()
	}
	m := &Manager{hub: hub, influx: influx, log: log, keepalive: map[uint][]func(){}}
	if influx != nil {
		m.points = make(chan *influxdb3.Point, influxBufSize)
		go m.writerLoop()
	}
	return m
}

// QueueTopic / InterfaceTopic harus identik dengan deviceTopic di handler SSE
// (`<deviceID>:<base>`) supaya broker dipakai bersama.
func QueueTopic(deviceID uint, interval string) string {
	return fmt.Sprintf("%d:%s", deviceID, sse.TopicQueueStats(interval))
}
func InterfaceTopic(deviceID uint, interval string) string {
	return fmt.Sprintf("%d:%s", deviceID, sse.TopicInterfaceStats(interval))
}

// QueueBroker memastikan SATU stream queue-stats untuk (device,interval) dan
// mengembalikan broker-nya. Producer: parse → snapshot + publish SSE + tulis
// Influx (bila aktif).
func (m *Manager) QueueBroker(net *network.Client, deviceID uint, topic string, interval time.Duration) *sse.Broker {
	return m.hub.GetOrCreate(topic,
		func(b *sse.Broker) error {
			return net.QueueStatsStreamParsed(topic, interval, func(q network.QueueSimpleWithStats) {
				ev := dto.FromDomainQueueStats(q)
				GetQueueSnap(topic).update(ev)
				b.Publish(sse.Event{Type: "stats", Data: ev})
				m.writeQueue(deviceID, ev)
			})
		},
		func() { net.StopStream(topic); deleteQueueSnap(topic) },
	)
}

// InterfaceBroker memastikan SATU stream interface-stats untuk (device,interval).
func (m *Manager) InterfaceBroker(net *network.Client, deviceID uint, topic string, interval time.Duration) *sse.Broker {
	return m.hub.GetOrCreate(topic,
		func(b *sse.Broker) error {
			return net.InterfaceStatsStream(topic, interval, func(sen *roslib.Sentence) {
				if sen.Word() != "!re" {
					return
				}
				ev := sentenceToInterfaceEvent(sen)
				b.Publish(sse.Event{Type: "stats", Data: ev})
				m.writeInterface(deviceID, ev)
			})
		},
		func() { net.StopStream(topic) },
	)
}

// StartDevice menahan stream queue+interface tetap hidup (subscriber permanen)
// saat Influx aktif, supaya historis terus terisi tanpa penonton SSE. Bila
// Influx nonaktif, tidak melakukan apa-apa (lifecycle stream mengikuti penonton).
func (m *Manager) StartDevice(deviceID uint, net *network.Client) {
	if m.influx == nil || net == nil {
		return
	}
	iv := LiveInterval.String()
	subs := []func(){
		m.keepAlive(m.QueueBroker(net, deviceID, QueueTopic(deviceID, iv), LiveInterval), fmt.Sprintf("netstream:%d:queue", deviceID)),
		m.keepAlive(m.InterfaceBroker(net, deviceID, InterfaceTopic(deviceID, iv), LiveInterval), fmt.Sprintf("netstream:%d:iface", deviceID)),
	}
	m.mu.Lock()
	m.keepalive[deviceID] = subs
	m.mu.Unlock()
	m.log.WithField("device", deviceID).Info("netstream: started (queue+interface) → influx + SSE")
}

// StopDevice melepas subscriber keep-alive → stream berhenti bila tak ada penonton.
func (m *Manager) StopDevice(deviceID uint) {
	m.mu.Lock()
	subs := m.keepalive[deviceID]
	delete(m.keepalive, deviceID)
	m.mu.Unlock()
	for _, unsub := range subs {
		unsub()
	}
}

// keepAlive subscribe permanen + drain channel (event diproses di producer);
// mengembalikan fungsi unsubscribe.
func (m *Manager) keepAlive(b *sse.Broker, id string) func() {
	ch, err := b.Subscribe(id)
	if err != nil {
		m.log.WithError(err).WithField("sub", id).Warn("netstream: keepalive subscribe failed")
		return func() {}
	}
	done := make(chan struct{})
	go func() {
		for {
			select {
			case <-done:
				return
			case _, ok := <-ch:
				if !ok {
					return
				}
			}
		}
	}()
	return func() { close(done); b.Unsubscribe(id) }
}

// ── Influx writers (dari dto, bukan sentence) ───────────────────────────────

func (m *Manager) writeQueue(deviceID uint, ev dto.QueueStatsEvent) {
	if m.influx == nil {
		return
	}
	bin, bout := splitInOut(ev.Bytes)
	pin, pout := splitInOut(ev.Packets)
	p := influxdb3.NewPointWithMeasurement("queue_stats").
		SetTimestamp(time.Now()).
		SetTag("device", strconv.FormatUint(uint64(deviceID), 10)).
		SetTag("queue", ev.Name).
		SetField("bytes_in", bin).SetField("bytes_out", bout).
		SetField("packets_in", pin).SetField("packets_out", pout)
	m.write(p)
}

func (m *Manager) writeInterface(deviceID uint, ev dto.InterfaceStatsEvent) {
	if m.influx == nil {
		return
	}
	p := influxdb3.NewPointWithMeasurement("interface_stats").
		SetTimestamp(time.Now()).
		SetTag("device", strconv.FormatUint(uint64(deviceID), 10)).
		SetTag("iface", ev.Name).
		SetField("rx_byte", ev.RxByte).SetField("tx_byte", ev.TxByte).
		SetField("rx_packet", ev.RxPacket).SetField("tx_packet", ev.TxPacket)
	m.write(p)
}

// write meng-enqueue point ke buffer asinkron. Non-blocking: bila buffer penuh
// (Influx lambat/down) point di-drop dengan log debug — JANGAN PERNAH blok di
// sini karena dipanggil dari dalam handler stream (lihat komentar field points).
func (m *Manager) write(p *influxdb3.Point) {
	if m.points == nil {
		return
	}
	select {
	case m.points <- p:
	default:
		m.log.Debug("netstream: influx buffer full, dropping point")
	}
}

// writerLoop menguras buffer points dan batch-flush ke Influx di luar jalur
// stream. Flush saat batch mencapai influxBatchMax atau tiap influxFlushEvery.
func (m *Manager) writerLoop() {
	const (
		influxBatchMax   = 500
		influxFlushEvery = 500 * time.Millisecond
	)
	ticker := time.NewTicker(influxFlushEvery)
	defer ticker.Stop()
	batch := make([]*influxdb3.Point, 0, influxBatchMax)

	flush := func() {
		if len(batch) == 0 {
			return
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		if err := m.influx.WritePoints(ctx, batch); err != nil {
			m.log.WithError(err).Debug("netstream: influx batch write failed")
		}
		cancel()
		batch = batch[:0]
	}

	for {
		select {
		case p := <-m.points:
			batch = append(batch, p)
			if len(batch) >= influxBatchMax {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
}

// splitInOut memecah "in/out" RouterOS → dua int64.
func splitInOut(s string) (int64, int64) {
	parts := strings.SplitN(s, "/", 2)
	if len(parts) != 2 {
		return 0, 0
	}
	in, _ := strconv.ParseInt(strings.TrimSpace(parts[0]), 10, 64)
	out, _ := strconv.ParseInt(strings.TrimSpace(parts[1]), 10, 64)
	return in, out
}

func sentenceToInterfaceEvent(s *roslib.Sentence) dto.InterfaceStatsEvent {
	return dto.InterfaceStatsEvent{
		ID:       s.Get(".id"),
		Name:     s.Get("name"),
		Type:     s.Get("type"),
		RxByte:   s.IntOr("rx-byte", 0),
		TxByte:   s.IntOr("tx-byte", 0),
		RxPacket: s.IntOr("rx-packet", 0),
		TxPacket: s.IntOr("tx-packet", 0),
		Running:  s.BoolOr("running", false),
		Disabled: s.BoolOr("disabled", false),
	}
}
