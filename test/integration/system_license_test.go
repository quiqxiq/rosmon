//go:build integration

package integration

import (
	"testing"

	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/mikrotik/system"
	"github.com/stretchr/testify/require"
)

// TestIntegration_License menguji /system/license/print one-shot.
func TestIntegration_License(t *testing.T) {
	c := testutil.NewClient(t)
	sys := system.New(c)

	ctx := testutil.Context(t)
	lic, err := sys.License(ctx)
	require.NoError(t, err)

	// Software-id selalu ada di router MikroTik.
	require.NotEmpty(t, lic.SoftwareID, "software-id tidak boleh kosong")
	t.Logf("license: software-id=%s nlevel=%s features=%s",
		lic.SoftwareID, lic.NLevel, lic.Features)
}
