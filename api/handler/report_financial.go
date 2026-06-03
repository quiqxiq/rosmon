package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/store"
)

// ReportFinancial handler — endpoint laporan keuangan berbasis DB.
// Tidak butuh DeviceMiddleware — data dari tabel invoices/payments/subscriptions.
type ReportFinancial struct {
	InvoiceStore store.InvoiceStore
	SubStore     store.SubscriptionStore
}

func NewReportFinancial(inv store.InvoiceStore, sub store.SubscriptionStore) *ReportFinancial {
	return &ReportFinancial{InvoiceStore: inv, SubStore: sub}
}

func (h *ReportFinancial) Register(g *gin.RouterGroup) {
	r := g.Group("/reports")
	r.GET("/financial", h.Monthly)
	r.GET("/aging", h.Aging)
	r.GET("/churn", h.Churn)
	r.GET("/dashboard", h.Dashboard)
}

// GET /reports/financial?year=2026&month=6
func (h *ReportFinancial) Monthly(c *gin.Context) {
	now := time.Now()
	year := now.Year()
	month := int(now.Month())
	if v := c.Query("year"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 2000 {
			year = n
		}
	}
	if v := c.Query("month"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 1 && n <= 12 {
			month = n
		}
	}

	fs, err := h.InvoiceStore.MonthlySummary(c.Request.Context(), year, month)
	if err != nil {
		WriteErr(c, err)
		return
	}
	outstanding := fs.TotalBilled - fs.TotalCollected
	WriteOK(c, dto.FinancialMonthlyResponse{
		Year:           year,
		Month:          month,
		TotalBilled:    fs.TotalBilled,
		TotalCollected: fs.TotalCollected,
		Outstanding:    outstanding,
		InvoiceCount:   fs.InvoiceCount,
		PaidCount:      fs.PaidCount,
		OverdueCount:   fs.OverdueCount,
	})
}

// GET /reports/aging
func (h *ReportFinancial) Aging(c *gin.Context) {
	asOf := time.Now()
	buckets, err := h.InvoiceStore.AgingBuckets(c.Request.Context(), asOf)
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.AgingBucket, len(buckets))
	for i, b := range buckets {
		out[i] = dto.AgingBucket{Label: b.Label, Count: b.Count, TotalAmount: b.TotalAmount}
	}
	WriteOK(c, dto.AgingReportResponse{
		AsOf:    asOf.Format(time.RFC3339),
		Buckets: out,
	})
}

// GET /reports/churn?year=2026
func (h *ReportFinancial) Churn(c *gin.Context) {
	year := time.Now().Year()
	if v := c.Query("year"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 2000 {
			year = n
		}
	}

	entries, err := h.SubStore.ChurnByMonth(c.Request.Context(), year)
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.ChurnEntry, len(entries))
	for i, e := range entries {
		out[i] = dto.ChurnEntry{Year: e.Year, Month: e.Month, Count: e.Count}
	}
	c.JSON(http.StatusOK, dto.OK(out))
}

// GET /reports/dashboard
func (h *ReportFinancial) Dashboard(c *gin.Context) {
	ctx := c.Request.Context()
	now := time.Now()

	sc, err := h.SubStore.StatusCounts(ctx)
	if err != nil {
		WriteErr(c, err)
		return
	}
	overdueCount, overdueAmount, err := h.InvoiceStore.CountOverdue(ctx)
	if err != nil {
		WriteErr(c, err)
		return
	}
	monthRevenue, err := h.InvoiceStore.SumPaidThisMonth(ctx, now.Year(), int(now.Month()))
	if err != nil {
		WriteErr(c, err)
		return
	}
	pendingPayments, err := h.InvoiceStore.CountPendingPayments(ctx)
	if err != nil {
		WriteErr(c, err)
		return
	}
	totalCustomers, err := h.SubStore.CountCustomers(ctx)
	if err != nil {
		WriteErr(c, err)
		return
	}

	WriteOK(c, dto.DashboardSummaryResponse{
		ActiveSubscriptions: sc.Active,
		IsolirCount:         sc.Isolir,
		SuspendedCount:      sc.Suspended,
		OverdueInvoices:     overdueCount,
		OverdueAmount:       overdueAmount,
		MonthlyRevenue:      monthRevenue,
		PendingPayments:     pendingPayments,
		TotalCustomers:      totalCustomers,
	})
}
