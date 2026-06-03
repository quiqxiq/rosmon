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
