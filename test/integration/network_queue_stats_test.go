//go:build integration

package integration

import (
	"sync/atomic"
	"testing"
	"time"

	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/mikrotik/network"
	"github.com/stretchr/testify/require"
)

// TestIntegration_QueueStatsByNameStream menguji /queue/simple/print stats
// ?name=<name> interval=<d>.
func TestIntegration_QueueStatsByNameStream(t *testing.T) {
	c := testutil.NewClient(t)
	net := network.New(c)

	const id = "it-queue-stats-name"
	// Cari queue default "default" (biasanya ada di queue tree/simple)
	name := "default"
	var got atomic.Int32

	err := net.QueueStatsByNameStream(id, name, 1*time.Second, func(s *roslib.Sentence) {
		if s.Word() == "!re" {
			got.Add(1)
			if got.Load() <= 3 {
				t.Logf("queue #%d: name=%s bytes=%s packets=%s rate=%s",
					got.Load(), s.Get("name"), s.Get("bytes"),
					s.Get("packets"), s.Get("rate"))
			}
		}
	})
	require.NoError(t, err)
	defer net.StopStream(id)

	require.Eventually(t, func() bool { return got.Load() >= 2 }, 5*time.Second, 200*time.Millisecond,
		"minimal 2 sample dalam 5s")

	t.Logf("queue stats by name received %d samples", got.Load())
}

// TestIntegration_ParentQueueStatsStream menguji /queue/simple/print stats
// ?dynamic=false interval=<d>.
func TestIntegration_ParentQueueStatsStream(t *testing.T) {
	c := testutil.NewClient(t)
	net := network.New(c)

	const id = "it-queue-parents"
	var got atomic.Int32

	err := net.ParentQueueStatsStream(id, 1*time.Second, func(s *roslib.Sentence) {
		if s.Word() == "!re" {
			got.Add(1)
			if got.Load() <= 3 {
				t.Logf("parent #%d: name=%s bytes=%s packets=%s rate=%s",
					got.Load(), s.Get("name"), s.Get("bytes"),
					s.Get("packets"), s.Get("rate"))
			}
		}
	})
	require.NoError(t, err)
	defer net.StopStream(id)

	require.Eventually(t, func() bool { return got.Load() >= 2 }, 5*time.Second, 200*time.Millisecond,
		"minimal 2 sample dalam 5s")

	t.Logf("parent queue stats received %d samples", got.Load())
}
