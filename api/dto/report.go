package dto

import "github.com/quiqxiq/rosmon/store/model"

// TransactionResponse adalah representasi 1 row transaksi penjualan
// voucher di response API.
type TransactionResponse struct {
	ID        uint   `json:"id"`
	SaleDate  string `json:"sale_date"`  // "jan/02/2006"
	SaleTime  string `json:"sale_time"`  // "15:04:05"
	SaleMonth string `json:"sale_month"` // "jan2025"
	Username  string `json:"username"`
	Price     int    `json:"price"`
	SellPrice int    `json:"sell_price"`
	IP        string `json:"ip,omitempty"`
	MAC       string `json:"mac,omitempty"`
	Validity  string `json:"validity,omitempty"`
	Profile   string `json:"profile,omitempty"`
	Comment   string `json:"comment,omitempty"`
	CreatedAt string `json:"created_at"`
}

// FromModelTransaction mengkonversi model row ke DTO.
func FromModelTransaction(t model.Transaction) TransactionResponse {
	return TransactionResponse{
		ID:        t.ID,
		SaleDate:  t.SaleDate,
		SaleTime:  t.SaleTime,
		SaleMonth: t.SaleMonth,
		Username:  t.Username,
		Price:     t.Price,
		SellPrice: t.SellPrice,
		IP:        t.IP,
		MAC:       t.MAC,
		Validity:  t.Validity,
		Profile:   t.Profile,
		Comment:   t.Comment,
		CreatedAt: t.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

// FromModelTransactions adalah convenience untuk slice.
func FromModelTransactions(ts []model.Transaction) []TransactionResponse {
	out := make([]TransactionResponse, len(ts))
	for i, t := range ts {
		out[i] = FromModelTransaction(t)
	}
	return out
}

// ReportSummary adalah agregat sederhana untuk dashboard.
type ReportSummary struct {
	Count          int                   `json:"count"`
	TotalPrice     int                   `json:"total_price"`
	TotalSellPrice int                   `json:"total_sell_price"`
	Profit         int                   `json:"profit"` // TotalSellPrice - TotalPrice
	ByProfile      map[string]int        `json:"by_profile,omitempty"`
	BySellPrice    map[string]int        `json:"by_sell_price,omitempty"`
	Transactions   []TransactionResponse `json:"transactions,omitempty"`
}

// ReportTodayResponse adalah response untuk endpoint GET /reports/selling/today.
// Berisi list transaksi pada hari ini beserta metadata count & date string.
type ReportTodayResponse struct {
	Date         string                `json:"date"` // "jan/02/2006"
	Count        int                   `json:"count"`
	Transactions []TransactionResponse `json:"transactions"`
}

// VoucherSaleResponse adalah shape yang diharapkan frontend Phase-6.
// Field name-nya berbeda dari TransactionResponse (sell_price→selling_price, dll).
type VoucherSaleResponse struct {
	ID             uint   `json:"id"`
	RouterID       uint   `json:"router_id"`
	SoldAt         string `json:"sold_at"`          // RFC3339
	Username       string `json:"username"`
	ProfileName    string `json:"profile_name"`
	Price          int    `json:"price"`
	SellingPrice   int    `json:"selling_price"`
	Server         string `json:"server"`
	IPAddress      string `json:"ip_address"`
	MACAddress     string `json:"mac_address"`
	Validity       string `json:"validity"`
	IdempotencyKey string `json:"idempotency_key"`
	CreatedAt      string `json:"created_at"`
}

// RecordSaleParams adalah input untuk POST /reports/sales
type RecordSaleParams struct {
	Username    string `json:"username" binding:"required"`
	ProfileName string `json:"profile_name"`
	Price       int    `json:"price"`
	Validity    string `json:"validity"`
	Server      string `json:"server"`
	IPAddress   string `json:"ip_address"`
	MACAddress  string `json:"mac_address"`
	SoldAt      string `json:"sold_at"`
}

// ImportResult adalah response untuk POST /reports/import
type ImportResult struct {
	Total    int `json:"total"`
	Imported int `json:"imported"`
	Skipped  int `json:"skipped"`
	Errors   int `json:"errors"`
}

// DailyReportResponse — GET /reports/daily
type DailyReportResponse struct {
	Date  string                `json:"date"`  // YYYY-MM-DD
	Sales []VoucherSaleResponse `json:"sales"`
	Total int                   `json:"total"` // sum selling_price
	Count int                   `json:"count"`
}

// DailySummaryRow — satu baris agregat harian dalam monthly report.
type DailySummaryRow struct {
	Date  string `json:"date"`  // YYYY-MM-DD
	Count int    `json:"count"`
	Sum   int    `json:"sum"`
}

// MonthlyReportResponse — GET /reports/monthly
type MonthlyReportResponse struct {
	Year  int               `json:"year"`
	Month int               `json:"month"`
	Daily []DailySummaryRow `json:"daily"`
	Total int               `json:"total"`
	Count int               `json:"count"`
}

// MonthlySummaryRow — satu baris agregat bulanan dalam resume report.
type MonthlySummaryRow struct {
	Month int `json:"month"` // 1-12
	Count int `json:"count"`
	Sum   int `json:"sum"`
}

// ResumeReportResponse — GET /reports/resume
type ResumeReportResponse struct {
	Year    int                 `json:"year"`
	Monthly []MonthlySummaryRow `json:"monthly"`
	Total   int                 `json:"total"`
	Count   int                 `json:"count"`
}

// VoucherDashboardSummary — GET /reports/summary
type VoucherDashboardSummary struct {
	TodayCount int `json:"today_count"`
	TodaySum   int `json:"today_sum"`
	MonthCount int `json:"month_count"`
	MonthSum   int `json:"month_sum"`
}

// FinancialMonthlyResponse adalah response untuk GET /reports/financial.
type FinancialMonthlyResponse struct {
	Year          int   `json:"year"`
	Month         int   `json:"month"`
	TotalBilled   int64 `json:"total_billed"`   // sum amount invoice issued+paid+overdue
	TotalCollected int64 `json:"total_collected"` // sum amount invoice paid
	Outstanding   int64 `json:"outstanding"`     // billed - collected
	InvoiceCount  int   `json:"invoice_count"`
	PaidCount     int   `json:"paid_count"`
	OverdueCount  int   `json:"overdue_count"`
}

// AgingBucket adalah satu bucket aging invoice.
type AgingBucket struct {
	Label       string `json:"label"`        // mis. "0-7 hari"
	Count       int    `json:"count"`
	TotalAmount int64  `json:"total_amount"`
}

// AgingReportResponse adalah response untuk GET /reports/aging.
type AgingReportResponse struct {
	AsOf    string        `json:"as_of"` // tanggal laporan, RFC3339
	Buckets []AgingBucket `json:"buckets"`
}

// ChurnEntry adalah churn per bulan.
type ChurnEntry struct {
	Year  int `json:"year"`
	Month int `json:"month"`
	Count int `json:"count"` // jumlah subscription terminated pada bulan ini
}

// DashboardSummaryResponse adalah response untuk GET /reports/dashboard.
type DashboardSummaryResponse struct {
	ActiveSubscriptions int   `json:"active_subscriptions"`
	IsolirCount         int   `json:"isolir_count"`
	SuspendedCount      int   `json:"suspended_count"`
	OverdueInvoices     int   `json:"overdue_invoices"`
	OverdueAmount       int64 `json:"overdue_amount"`
	MonthlyRevenue      int64 `json:"monthly_revenue"`       // invoice paid bulan ini
	PendingPayments     int   `json:"pending_payments"`      // payment pending confirmation
	TotalCustomers      int   `json:"total_customers"`
}
