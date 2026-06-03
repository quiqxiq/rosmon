package handler

import (
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/api/sse"
	"github.com/quiqxiq/rosmon/service/netstream"
)

// Konsolidasi: SATU stream `/queue/simple print stats interval=` per device
// (dimiliki service/netstream) melayani semua view. Filter dilakukan di sisi
// Go dari snapshot. Parent bersifat relasional (queue yang dijadikan parent
// oleh queue lain) → butuh snapshot semua queue.

// queueKeep mengembalikan predikat filter untuk view queue. nil = semua.
// Snapshot di-resolve dari registry netstream per `topic` saat runtime.
//   filter: "" | "all" | "dynamic" | "static" | "parent"
func queueKeep(filter, topic string) func(sse.Event) bool {
	switch filter {
	case "parent":
		return func(ev sse.Event) bool {
			q, ok := ev.Data.(dto.QueueStatsEvent)
			return ok && netstream.GetQueueSnap(topic).IsParent(q.Name)
		}
	case "dynamic":
		return func(ev sse.Event) bool {
			q, ok := ev.Data.(dto.QueueStatsEvent)
			return ok && q.Dynamic
		}
	case "static":
		return func(ev sse.Event) bool {
			q, ok := ev.Data.(dto.QueueStatsEvent)
			return ok && !q.Dynamic
		}
	default:
		return nil // all
	}
}

// ifaceKeep memfilter interface stats per `type` (ether/vlan/bridge/…).
// "" / "all" = semua.
func ifaceKeep(typ string) func(sse.Event) bool {
	if typ == "" || typ == "all" {
		return nil
	}
	return func(ev sse.Event) bool {
		e, ok := ev.Data.(dto.InterfaceStatsEvent)
		return ok && e.Type == typ
	}
}
