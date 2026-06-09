package handler_test

import (
	"context"
	"net/http"
	"strconv"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupInvoiceEngine membangun gin engine dengan handler Invoices + fake store.
// Billing sengaja nil — test hanya menyentuh jalur List/Cancel/validasi Generate
// yang return SEBELUM memanggil Billing.
func setupInvoiceEngine(t *testing.T) (*gin.Engine, *fakeInvoiceStore, *fakeSubscriptionStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	invS := newFakeInvoiceStore()
	subS := newFakeSubStore()
	h := handler.NewInvoices(invS, nil)
	h.SubStore = subS
	r := gin.New()
	h.Register(r.Group("/api/v1"))
	return r, invS, subS
}

func ymd(y int, m time.Month, d int) time.Time {
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func itoa(id uint) string { return strconv.FormatUint(uint64(id), 10) }

func TestInvoices_List_FilterByMonth(t *testing.T) {
	r, invS, _ := setupInvoiceEngine(t)
	invS.put(model.Invoice{InvoiceNumber: "INV-JUN", CustomerID: 1, SubscriptionID: 1, Amount: 150000, Status: "issued", PeriodStart: ymd(2026, time.June, 1)})
	invS.put(model.Invoice{InvoiceNumber: "INV-JUL", CustomerID: 1, SubscriptionID: 1, Amount: 150000, Status: "issued", PeriodStart: ymd(2026, time.July, 1)})

	w := doJSON(r, http.MethodGet, "/api/v1/invoices?year=2026&month=6", nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	// Filter diteruskan ke store.
	assert.Equal(t, 2026, invS.lastFilter.Year)
	assert.Equal(t, 6, invS.lastFilter.Month)
	// Hanya invoice Juni yang muncul.
	assert.Contains(t, w.Body.String(), "INV-JUN")
	assert.NotContains(t, w.Body.String(), "INV-JUL")
}

func TestInvoices_List_FilterByCustomerAndStatus(t *testing.T) {
	r, invS, _ := setupInvoiceEngine(t)
	invS.put(model.Invoice{InvoiceNumber: "INV-C1-ISSUED", CustomerID: 1, SubscriptionID: 1, Amount: 100000, Status: "issued", PeriodStart: ymd(2026, time.June, 1)})
	invS.put(model.Invoice{InvoiceNumber: "INV-C1-PAID", CustomerID: 1, SubscriptionID: 1, Amount: 100000, Status: "paid", PeriodStart: ymd(2026, time.June, 1)})
	invS.put(model.Invoice{InvoiceNumber: "INV-C2-ISSUED", CustomerID: 2, SubscriptionID: 2, Amount: 100000, Status: "issued", PeriodStart: ymd(2026, time.June, 1)})

	w := doJSON(r, http.MethodGet, "/api/v1/invoices?customer_id=1&status=issued", nil)
	require.Equal(t, http.StatusOK, w.Code)
	assert.EqualValues(t, 1, invS.lastFilter.CustomerID)
	assert.Equal(t, "issued", invS.lastFilter.Status)
	assert.Contains(t, w.Body.String(), "INV-C1-ISSUED")
	assert.NotContains(t, w.Body.String(), "INV-C1-PAID")
	assert.NotContains(t, w.Body.String(), "INV-C2-ISSUED")
}

func TestInvoices_Generate_BadPeriodStart_400(t *testing.T) {
	r, _, _ := setupInvoiceEngine(t)
	w := doJSON(r, http.MethodPost, "/api/v1/invoices/generate", map[string]any{
		"subscription_id": 1, "customer_id": 1, "period_start": "06-2026",
	})
	assert.Equal(t, http.StatusBadRequest, w.Code, "body: %s", w.Body.String())
}

func TestInvoices_Generate_CustomerMismatch_400(t *testing.T) {
	r, _, subS := setupInvoiceEngine(t)
	sub := &model.Subscription{CustomerID: 1, DeviceID: 1, ServiceType: "pppoe", MikrotikUsername: "budi", Status: "active", SyncStatus: "synced"}
	require.NoError(t, subS.Create(context.Background(), sub))

	w := doJSON(r, http.MethodPost, "/api/v1/invoices/generate", map[string]any{
		"subscription_id": sub.ID, "customer_id": 999, "period_start": "2026-06-01",
	})
	assert.Equal(t, http.StatusBadRequest, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), "customer_id tidak sesuai")
}

func TestInvoices_Cancel_Paid_409(t *testing.T) {
	r, invS, _ := setupInvoiceEngine(t)
	inv := invS.put(model.Invoice{InvoiceNumber: "INV-PAID", CustomerID: 1, SubscriptionID: 1, Amount: 100000, Status: "paid"})

	w := doJSON(r, http.MethodPost, "/api/v1/invoices/"+itoa(inv.ID)+"/cancel", nil)
	assert.Equal(t, http.StatusConflict, w.Code, "body: %s", w.Body.String())
}

func TestInvoices_Cancel_Issued_OK(t *testing.T) {
	r, invS, _ := setupInvoiceEngine(t)
	inv := invS.put(model.Invoice{InvoiceNumber: "INV-ISSUED", CustomerID: 1, SubscriptionID: 1, Amount: 100000, Status: "issued"})

	w := doJSON(r, http.MethodPost, "/api/v1/invoices/"+itoa(inv.ID)+"/cancel", nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	got, _ := invS.GetByID(context.Background(), inv.ID)
	assert.Equal(t, "cancelled", got.Status)
}
