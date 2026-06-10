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

	ctx := testutil.Context(t)
	// Create a temporary simple queue for the stream test.
	reply, err := c.Path("/queue/simple").Add(ctx,
		roslib.NewPair("name", "it-queue-stats-name"),
		roslib.NewPair("target", "192.168.111.250/32"),
	)
	require.NoError(t, err)
	var queueID string
	if reply.Done != nil {
		queueID = reply.Done.Map["ret"]
	}
	if queueID != "" {
		defer func() {
			_, _ = c.Path("/queue/simple").Remove(testutil.Context(t), queueID)
		}()
	}

	const id = "it-queue-stats-name-stream"
	name := "it-queue-stats-name"
	var got atomic.Int32

	err = net.QueueStatsByNameStream(id, name, 1*time.Second, func(s *roslib.Sentence) {
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

	ctx := testutil.Context(t)
	// Create a temporary parent simple queue (dynamic=false).
	reply, err := c.Path("/queue/simple").Add(ctx,
		roslib.NewPair("name", "it-queue-parent"),
		roslib.NewPair("target", "192.168.111.251/32"),
	)
	require.NoError(t, err)
	var queueID string
	if reply.Done != nil {
		queueID = reply.Done.Map["ret"]
	}
	if queueID != "" {
		defer func() {
			_, _ = c.Path("/queue/simple").Remove(testutil.Context(t), queueID)
		}()
	}

	const id = "it-queue-parents"
	var got atomic.Int32

	err = net.ParentQueueStatsStream(id, 1*time.Second, func(s *roslib.Sentence) {
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
