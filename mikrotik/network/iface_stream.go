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

// InterfaceStatsStream → /interface/print stats interval=<d>.
// Counter byte/packet per interface, update tiap interval.
func (c *Client) InterfaceStatsStream(id string, interval time.Duration, h func(*roslib.Sentence)) error {
	return c.dev.Path("/interface").Print().Stats().
		Interval(interval).Stream(id, h)
}

// QueueStatsStream → /queue/simple/print stats interval=<d> (analisis §1.10).
// Counter per queue (bytes, packets, rate).
func (c *Client) QueueStatsStream(id string, interval time.Duration, h func(*roslib.Sentence)) error {
	return c.dev.Path("/queue/simple").Print().Stats().
		Interval(interval).Stream(id, h)
}

// QueueStatsByNameStream → /queue/simple/print stats ?name=<name> interval=<d> (analisis §1.10).
// Counter per queue difilter by name. Proplist memperkecil payload.
func (c *Client) QueueStatsByNameStream(id, name string, interval time.Duration, h func(*roslib.Sentence)) error {
	return c.dev.Path("/queue/simple").Print().Stats().
		Where("name", name).
		Proplist("name", "target", "parent", "max-limit", "limit-at", "bytes", "packets", "rate", "total-rate", "queued-bytes", "queued-packets", "dropped").
		Interval(interval).Stream(id, h)
}

// ParentQueueStatsStream → /queue/simple/print stats ?dynamic=false interval=<d> (analisis §1.10).
// Hanya queue user-defined (bukan auto-generated). Proplist memperkecil payload.
func (c *Client) ParentQueueStatsStream(id string, interval time.Duration, h func(*roslib.Sentence)) error {
	return c.dev.Path("/queue/simple").Print().Stats().
		Where("dynamic", "false").
		Proplist("name", "target", "parent", "max-limit", "limit-at", "bytes", "packets", "rate", "total-rate", "queued-bytes", "queued-packets", "dropped").
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

// StopStream menghentikan listener dengan ID tersebut.
// Return true bila listener ada dan dihapus.
func (c *Client) StopStream(id string) bool {
	return c.dev.UnregisterStream(id)
}
