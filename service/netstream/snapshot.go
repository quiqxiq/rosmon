package netstream

import (
	"sync"

	"github.com/quiqxiq/rosmon/api/dto"
)

// queueSnap menyimpan snapshot terbaru queue per-nama untuk satu topic
// (device+interval). Dipakai menghitung relasi parent (queue yang dijadikan
// parent oleh queue lain) yang butuh seluruh set queue.
type queueSnap struct {
	mu     sync.RWMutex
	byName map[string]dto.QueueStatsEvent
}

func (q *queueSnap) update(e dto.QueueStatsEvent) {
	q.mu.Lock()
	q.byName[e.Name] = e
	q.mu.Unlock()
}

// IsParent true bila `name` direferensikan sebagai parent oleh queue lain.
func (q *queueSnap) IsParent(name string) bool {
	q.mu.RLock()
	defer q.mu.RUnlock()
	for _, e := range q.byName {
		if p := e.Parent; p != "" && p != "none" && p == name {
			return true
		}
	}
	return false
}

// registry global topic → *queueSnap (producer & filter SSE berbagi via topic).
var queueSnaps sync.Map

func GetQueueSnap(topic string) *queueSnap {
	v, _ := queueSnaps.LoadOrStore(topic, &queueSnap{byName: map[string]dto.QueueStatsEvent{}})
	return v.(*queueSnap)
}

func deleteQueueSnap(topic string) { queueSnaps.Delete(topic) }
