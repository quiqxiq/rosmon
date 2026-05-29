//go:build integration

package integration

import (
	"strings"
	"testing"

	"github.com/quiqxiq/rosmon/domain"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/mikrotik/hotspot"
	"github.com/quiqxiq/rosmon/workflows"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestIntegration_VoucherGenerate_10_thenList_thenBulkDelete melakukan
// full lifecycle: generate 10 voucher → list verify ada → bulk delete →
// list verify hilang.
func TestIntegration_VoucherGenerate_10_thenList_thenBulkDelete(t *testing.T) {
	dev := testutil.NewClient(t)
	wf := workflows.New(dev)
	hot := hotspot.New(dev)
	ctx := testutil.Context(t)

	prefix := testutil.UniqueName(t, "vch")[:24] // keep prefix short for username length

	spec := domain.VoucherSpec{
		Server:    "all",
		UserMode:  "vc",
		Length:    6,
		Prefix:    prefix,
		Charset:   domain.Charset("lower_number"),
		Profile:   "default",
		BatchSize: 10,
	}

	created, err := workflows.GenerateVouchers(ctx, wf, spec)
	require.NoError(t, err)
	require.Len(t, created, 10)

	// Cleanup safety-net: kalau test gagal sebelum bulk delete.
	ids := make([]string, len(created))
	for i, v := range created {
		ids[i] = v.ID
	}
	t.Cleanup(func() {
		_ = workflows.BulkDeleteUsers(testutil.Context(t), wf, ids)
	})

	// List dan verify ada minimal 10 user dengan prefix kita.
	users, err := hot.UserList(ctx)
	require.NoError(t, err)
	var matched int
	for _, u := range users {
		if strings.HasPrefix(u.Name, prefix) {
			matched++
		}
	}
	assert.GreaterOrEqual(t, matched, 10, "expected 10 vouchers with prefix %s", prefix)

	// Bulk delete.
	require.NoError(t, workflows.BulkDeleteUsers(ctx, wf, ids))

	// Verify hilang.
	users, err = hot.UserList(ctx)
	require.NoError(t, err)
	for _, u := range users {
		assert.False(t, strings.HasPrefix(u.Name, prefix),
			"voucher %s should have been deleted", u.Name)
	}
}
