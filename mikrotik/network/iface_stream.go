package network

import (
	"time"

	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/domain"
)

// InterfaceTrafficStream → /interface/monitor-traffic interface=<name>
// (analisis §1.11). Inherent streaming — router emit reply berkala sampai
// /cancel. Stop dengan dev.UnregisterStream(id) atau StopStream(id).
func (c *Client) InterfaceTrafficStream(id, iface string, h func(*roslib.Sentence)) error {
	return c.dev.Path("/interface/monitor-traffic").
		With("interface", iface).
		Stream(id, h)
}

// queueStatsProplist memperkecil payload queue stream.
var queueStatsProplist = []string{"name", "target", "parent", "max-limit", "limit-at", "bytes", "packets", "rate", "total-rate", "queued-bytes", "queued-packets", "dropped", "disabled", "dynamic"}

var interfaceStatsProplist = []string{"name", "type", "rx-byte", "tx-byte", "rx-packet", "tx-packet", "running", "disabled"}

// InterfaceStatsStream → /interface/print stats interval=<d> (streaming, MikroTik
// yang push tiap interval — BUKAN poll dari Go). Counter byte/packet per
// interface kumulatif → caller hitung rate dari delta.
func (c *Client) InterfaceStatsStream(id string, interval time.Duration, h func(*roslib.Sentence)) error {
	return c.dev.Path("/interface").Print().Stats().
		Proplist(interfaceStatsProplist...).
		Interval(interval).Stream(id, h)
}

// QueueStatsStream → /queue/simple/print stats interval=<d> (streaming, analisis §1.10).
func (c *Client) QueueStatsStream(id string, interval time.Duration, h func(*roslib.Sentence)) error {
	return c.dev.Path("/queue/simple").Print().Stats().
		Proplist(queueStatsProplist...).
		Interval(interval).Stream(id, h)
}

// QueueStatsByNameStream → /queue/simple/print stats ?name=<name> interval=<d>.
func (c *Client) QueueStatsByNameStream(id, name string, interval time.Duration, h func(*roslib.Sentence)) error {
	return c.dev.Path("/queue/simple").Print().Stats().
		Where("name", name).
		Proplist(queueStatsProplist...).
		Interval(interval).Stream(id, h)
}

// ParentQueueStatsStream → /queue/simple/print stats ?dynamic=false interval=<d>.
// Hanya queue user-defined (bukan auto-generated).
func (c *Client) ParentQueueStatsStream(id string, interval time.Duration, h func(*roslib.Sentence)) error {
	return c.dev.Path("/queue/simple").Print().Stats().
		Where("dynamic", "false").
		Proplist(queueStatsProplist...).
		Interval(interval).Stream(id, h)
}

// QueueSimpleWithStats → /queue/simple/print stats interval=<d> (analisis §1.10).
type QueueSimpleWithStats = domain.QueueSimpleWithStats

// QueueStatsStreamParsed → /queue/simple/print stats interval=<d> (analisis §1.10).
func (c *Client) QueueStatsStreamParsed(id string, interval time.Duration, h func(QueueSimpleWithStats)) error {
	return c.QueueStatsStream(id, interval, func(s *roslib.Sentence) {
		if s.Word() != "!re" {
			return
		}
		h(sentenceToQueue(s))
	})
}

// StopStream menghentikan listener dengan ID tersebut. Menutup baik stream
// (monitor-traffic) maupun poll (interface/queue stats) karena handler SSE
// memanggil ini untuk kedua jenis.
func (c *Client) StopStream(id string) bool {
	s := c.dev.UnregisterStream(id)
	p := c.dev.UnregisterPoll(id)
	return s || p
}
