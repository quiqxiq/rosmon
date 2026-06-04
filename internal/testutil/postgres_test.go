//go:build dbtest

package testutil

import (
	"context"
	"testing"

	"github.com/quiqxiq/rosmon/store/model"
	"github.com/stretchr/testify/require"
)

// TestNewPostgres_migrateAndInsert verifikasi container start, migrate
// jalan, dan store dapat insert/query row sederhana.
func TestNewPostgres_migrateAndInsert(t *testing.T) {
	devStore, _, txStore := NewStores(t)

	ctx := context.Background()
	d := &model.MikrotikDevice{
		DisplayName: "smoke",
		Host:        "127.0.0.1",
		Port:        8728,
		Username:    "u",
		Password:    "p",
		Active:      true,
	}
	require.NoError(t, devStore.Create(ctx, d))
	require.NotZero(t, d.ID)

	tx := &model.Transaction{
		DeviceID:  d.ID,
		SaleDate:  "jan/02/2026",
		SaleTime:  "10:00:00",
		SaleMonth: "jan2026",
		Username:  "u1",
		Price:     10000,
	}
	require.NoError(t, txStore.Create(ctx, tx))

	txs, err := txStore.ListByDevice(ctx, d.ID, "jan2026")
	require.NoError(t, err)
	require.Len(t, txs, 1)
	require.Equal(t, uint(d.ID), txs[0].DeviceID)
}
