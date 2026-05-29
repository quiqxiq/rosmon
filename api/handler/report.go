package handler

import (
	"encoding/csv"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
)

// Report meng-handle endpoint laporan penjualan voucher.
// Sumber data: tabel transactions (di-tulis oleh webhook on-login handler).
//
// Endpoint:
//   - GET /reports/selling                — full list, filter by ?month=
//   - GET /reports/selling/today          — list per tanggal hari ini
//   - GET /reports/selling/summary        — agregat (count, total, profit, breakdown)
//   - GET /reports/selling.csv            — CSV export (filter by ?month= atau ?date=)
type Report struct {
	DeviceStore store.DeviceStore
	TxStore     store.TransactionStore
}

func NewReport(devStore store.DeviceStore, txStore store.TransactionStore) *Report {
	return &Report{DeviceStore: devStore, TxStore: txStore}
}

func (h *Report) Register(g *gin.RouterGroup) {
	r := g.Group("/reports")
	r.GET("/selling", h.SellingList)
	r.GET("/selling/today", h.SellingToday)
	r.GET("/selling/summary", h.SellingSummary)
	r.GET("/selling.csv", h.SellingCSV)
}

// parseDeviceID ambil :device_id dari path (numeric). Tulis 400
// kalau invalid dan return ok=false.
func (h *Report) parseDeviceID(c *gin.Context) (uint, bool) {
	raw := c.Param("device_id")
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ID", "invalid device id", raw))
		return 0, false
	}
	return uint(n), true
}

// SellingList: GET /reports/selling?month=jan2025
// Kalau ?month kosong, return semua transaksi device tsb.
func (h *Report) SellingList(c *gin.Context) {
	deviceID, ok := h.parseDeviceID(c)
	if !ok {
		return
	}
	month := strings.ToLower(c.Query("month"))
	txs, err := h.TxStore.ListByDevice(c.Request.Context(), deviceID, month)
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := dto.FromModelTransactions(txs)
	WriteList(c, out, len(out))
}

// SellingToday: GET /reports/selling/today
// SaleDate format mikhmon = "jan/02/2006" (lowercase month).
func (h *Report) SellingToday(c *gin.Context) {
	deviceID, ok := h.parseDeviceID(c)
	if !ok {
		return
	}
	today := strings.ToLower(time.Now().Format("Jan/02/2006"))
	txs, err := h.TxStore.ListByDeviceDate(c.Request.Context(), deviceID, today)
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := dto.FromModelTransactions(txs)
	WriteOK(c, dto.ReportTodayResponse{
		Date:         today,
		Count:        len(out),
		Transactions: out,
	})
}

// SellingSummary: GET /reports/selling/summary?month=jan2025&include_transactions=true
// Agregat sederhana untuk dashboard.
func (h *Report) SellingSummary(c *gin.Context) {
	deviceID, ok := h.parseDeviceID(c)
	if !ok {
		return
	}
	month := strings.ToLower(c.Query("month"))
	includeTx := c.Query("include_transactions") == "true"

	txs, err := h.TxStore.ListByDevice(c.Request.Context(), deviceID, month)
	if err != nil {
		WriteErr(c, err)
		return
	}
	summary := aggregate(txs)
	if includeTx {
		summary.Transactions = dto.FromModelTransactions(txs)
	}
	WriteOK(c, summary)
}

// SellingCSV: GET /reports/selling.csv?month=jan2025
// atau ?date=jan/05/2025.
// Header: sale_date,sale_time,username,profile,price,sell_price,validity,mac,ip,comment.
func (h *Report) SellingCSV(c *gin.Context) {
	deviceID, ok := h.parseDeviceID(c)
	if !ok {
		return
	}
	month := strings.ToLower(c.Query("month"))
	date := strings.ToLower(c.Query("date"))

	var (
		txs []model.Transaction
		err error
	)
	switch {
	case date != "":
		txs, err = h.TxStore.ListByDeviceDate(c.Request.Context(), deviceID, date)
	default:
		txs, err = h.TxStore.ListByDevice(c.Request.Context(), deviceID, month)
	}
	if err != nil {
		WriteErr(c, err)
		return
	}

	filename := "selling-" + c.Param("device_id")
	switch {
	case month != "":
		filename += "-" + month
	case date != "":
		filename += "-" + strings.ReplaceAll(date, "/", "")
	}
	filename += ".csv"

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", `attachment; filename="`+filename+`"`)
	c.Status(http.StatusOK)

	w := csv.NewWriter(c.Writer)
	_ = w.Write([]string{
		"sale_date", "sale_time", "username", "profile",
		"price", "sell_price", "validity", "mac", "ip", "comment",
	})
	for _, t := range txs {
		_ = w.Write([]string{
			t.SaleDate, t.SaleTime, t.Username, t.Profile,
			strconv.Itoa(t.Price), strconv.Itoa(t.SellPrice),
			t.Validity, t.MAC, t.IP, t.Comment,
		})
	}
	w.Flush()
}

// aggregate menghitung summary dari slice transaksi: count, totals, dan
// breakdown by profile. Dipisah ke helper supaya mudah di-unit-test.
func aggregate(txs []model.Transaction) dto.ReportSummary {
	s := dto.ReportSummary{
		Count:     len(txs),
		ByProfile: map[string]int{},
	}
	for _, t := range txs {
		s.TotalPrice += t.Price
		s.TotalSellPrice += t.SellPrice
		if t.Profile != "" {
			s.ByProfile[t.Profile]++
		}
	}
	s.Profit = s.TotalSellPrice - s.TotalPrice
	if len(s.ByProfile) == 0 {
		s.ByProfile = nil
	}
	return s
}

// errStr adalah helper untuk WriteValidationErr ketika error sederhana
// tidak punya struktur validator (mis. missing path param).
type strErr string

func (e strErr) Error() string { return string(e) }
func errStr(s string) error    { return strErr(s) }
