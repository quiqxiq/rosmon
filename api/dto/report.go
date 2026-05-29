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
