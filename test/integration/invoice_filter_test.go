//go:build dbtest

package integration

import (
	"context"
	"net/http"
	"testing"

	"github.com/quiqxiq/rosmon/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestIntegration_Invoice_FilterByMonth memverifikasi filter bulan/tahun
// (berbasis period_start) di store.List dan via HTTP GET /invoices?year=&month=.
func TestIntegration_Invoice_FilterByMonth(t *testing.T) {
	env := setupBillingEnv(t)
	ctx := context.Background()

	cust, sub := seedBillingPPPSubscription(t, ctx, env, "Pak Filter", "081300009999")

	// Generate invoice untuk dua periode berbeda (Juni & Juli 2026).
	junNo := generateInvoiceForPeriod(t, env, sub.ID, cust.ID, "2026-06-01")
	julNo := generateInvoiceForPeriod(t, env, sub.ID, cust.ID, "2026-07-01")
	require.NotEqual(t, junNo, julNo)

	// store.List Year+Month → hanya Juni.
	jun, err := env.InvStore.List(ctx, store.InvoiceListFilter{Year: 2026, Month: 6})
	require.NoError(t, err)
	require.Len(t, jun, 1)
	assert.Equal(t, junNo, jun[0].InvoiceNumber)

	jul, err := env.InvStore.List(ctx, store.InvoiceListFilter{Year: 2026, Month: 7})
	require.NoError(t, err)
	require.Len(t, jul, 1)
	assert.Equal(t, julNo, jul[0].InvoiceNumber)

	// Kombinasi customer + bulan.
	combo, err := env.InvStore.List(ctx, store.InvoiceListFilter{CustomerID: cust.ID, Year: 2026, Month: 6})
	require.NoError(t, err)
	require.Len(t, combo, 1)
	assert.Equal(t, junNo, combo[0].InvoiceNumber)

	// Via HTTP — hanya Juni yang tampil.
	w := httpJSON(env.HTTP, http.MethodGet, "/api/v1/invoices?year=2026&month=6", nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), junNo)
	assert.NotContains(t, w.Body.String(), julNo)
}

func generateInvoiceForPeriod(t *testing.T, env billingEnv, subID, custID uint, periodStart string) string {
	t.Helper()
	w := httpJSON(env.HTTP, http.MethodPost, "/api/v1/invoices/generate", map[string]any{
		"subscription_id": subID,
		"customer_id":     custID,
		"period_start":    periodStart,
		"due_days":        7,
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	var inv struct {
		InvoiceNumber string `json:"invoice_number"`
	}
	decodeData(t, w, &inv)
	require.NotEmpty(t, inv.InvoiceNumber)
	return inv.InvoiceNumber
}
