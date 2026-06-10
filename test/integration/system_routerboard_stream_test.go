//go:build integration

package integration

import (
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/mikrotik/system"
	"github.com/stretchr/testify/require"
)

// TestIntegration_SystemMonitorRouterboard menguji poll
// /system/routerboard/print per interval.
func TestIntegration_SystemMonitorRouterboard(t *testing.T) {
	c := testutil.NewClient(t)
	sys := system.New(c)

	// Skip if system/routerboard is not supported (e.g. on virtual CHR routers).
	_, err := sys.Routerboard(testutil.Context(t))
	if err != nil && strings.Contains(err.Error(), "no such command") {
		t.Skip("skipping routerboard stream test: device does not support /system/routerboard")
	}

	const id = "it-routerboard"
	var got atomic.Int32

	err = sys.MonitorRouterboard(id, 1*time.Second, func(s *roslib.Sentence) {
		if s.Word() == "!re" {
			got.Add(1)
			if got.Load() <= 3 {
				t.Logf("routerboard #%d: board=%s model=%s serial=%s current-fw=%s",
					got.Load(), s.Get("board-name"), s.Get("model"),
					s.Get("serial-number"), s.Get("current-firmware"))
			}
		}
	})
	require.NoError(t, err)
	defer sys.StopMonitor(id)

	require.Eventually(t, func() bool { return got.Load() >= 2 }, 5*time.Second, 200*time.Millisecond,
		"minimal 2 sample dalam 5s")

	t.Logf("routerboard stream received %d samples", got.Load())
}
