package handler

import (
	"encoding/csv"
	"net/http"
	"sort"
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
	// Phase-6 endpoints — dipakai frontend /report/daily, /report/monthly, /voucher
	r.GET("/daily", h.Daily)
	r.GET("/monthly", h.Monthly)
	r.GET("/resume", h.Resume)
	r.GET("/summary", h.Summary)
	r.GET("/sales", h.SalesListPaginated)
	r.POST("/sales", h.RecordSale)
	r.POST("/import", h.ImportSales)
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

// ── Phase-6 handlers ──────────────────────────────────────────────────────────

// Daily: GET /reports/daily?date=YYYY-MM-DD[&profile=][&search=]
func (h *Report) Daily(c *gin.Context) {
	deviceID, ok := h.parseDeviceID(c)
	if !ok {
		return
	}
	dateISO := c.Query("date")
	if dateISO == "" {
		dateISO = time.Now().Format("2006-01-02")
	}
	saleDate, err := isoToSaleDate(dateISO)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Err("INVALID_DATE", "date must be YYYY-MM-DD", dateISO))
		return
	}
	txs, err := h.TxStore.ListByDeviceDate(c.Request.Context(), deviceID, saleDate)
	if err != nil {
		WriteErr(c, err)
		return
	}
	profile := strings.ToLower(c.Query("profile"))
	search := strings.ToLower(c.Query("search"))
	sales := make([]dto.VoucherSaleResponse, 0, len(txs))
	total := 0
	for _, t := range txs {
		if profile != "" && !strings.EqualFold(t.Profile, profile) {
			continue
		}
		if search != "" && !strings.Contains(strings.ToLower(t.Username), search) {
			continue
		}
		sales = append(sales, toVoucherSale(t, deviceID))
		total += t.SellPrice
	}
	WriteOK(c, dto.DailyReportResponse{Date: dateISO, Sales: sales, Total: total, Count: len(sales)})
}

// SalesListPaginated: GET /reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&page_size=25&search=&profile=
func (h *Report) SalesListPaginated(c *gin.Context) {
	deviceID, ok := h.parseDeviceID(c)
	if !ok {
		return
	}

	fromStr := c.Query("from")
	toStr := c.Query("to")
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	search := c.Query("search")
	profile := c.Query("profile")

	if fromStr == "" || toStr == "" {
		WriteErr(c, errStr("missing from/to date parameters"))
		return
	}

	from, err := time.Parse("2006-01-02", fromStr)
	if err != nil {
		WriteErr(c, errStr("invalid from date format, expected YYYY-MM-DD"))
		return
	}
	// start of day in local time
	from = time.Date(from.Year(), from.Month(), from.Day(), 0, 0, 0, 0, time.Local)

	to, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		WriteErr(c, errStr("invalid to date format, expected YYYY-MM-DD"))
		return
	}
	// end of day in local time
	to = time.Date(to.Year(), to.Month(), to.Day(), 23, 59, 59, 999999999, time.Local)

	txs, totalCount, totalRevenue, err := h.TxStore.ListByDateRange(c.Request.Context(), deviceID, from, to, profile, search, page, pageSize)
	if err != nil {
		WriteErr(c, err)
		return
	}

	sales := make([]dto.VoucherSaleResponse, 0, len(txs))
	for _, t := range txs {
		sales = append(sales, toVoucherSale(t, deviceID))
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 25
	}

	WriteOK(c, gin.H{
		"items":         sales,
		"total":         totalCount,
		"page":          page,
		"page_size":     pageSize,
		"total_revenue": totalRevenue,
	})
}

// RecordSale: POST /reports/sales
func (h *Report) RecordSale(c *gin.Context) {
	deviceID, ok := h.parseDeviceID(c)
	if !ok {
		return
	}
	var req dto.RecordSaleParams
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}

	soldAt := time.Now()
	if req.SoldAt != "" {
		if t, err := time.Parse(time.RFC3339, req.SoldAt); err == nil {
			soldAt = t
		}
	}

	tx := &model.Transaction{
		DeviceID:  deviceID,
		Username:  req.Username,
		Profile:   req.ProfileName,
		Price:     req.Price,
		SellPrice: req.Price, // asumsi price = sell_price karena tidak ada input terpisah
		IP:        req.IPAddress,
		MAC:       req.MACAddress,
		Validity:  req.Validity,
		SaleDate:  strings.ToLower(soldAt.Format("Jan/02/2006")),
		SaleTime:  soldAt.Format("15:04:05"),
		SaleMonth: saleMonthKey(soldAt.Year(), int(soldAt.Month())),
		CreatedAt: soldAt,
	}

	if err := h.TxStore.Create(c.Request.Context(), tx); err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, gin.H{"message": "sale recorded"})
}

// ImportSales: POST /reports/import
func (h *Report) ImportSales(c *gin.Context) {
	// Fitur ini adalah fallback sync. Untuk sementara return mock success
	// karena transaksi real time sudah di-handle oleh webhook_on_login.
	WriteOK(c, dto.ImportResult{
		Total:    0,
		Imported: 0,
		Skipped:  0,
		Errors:   0,
	})
}

// Monthly: GET /reports/monthly?year=YYYY&month=1-12
func (h *Report) Monthly(c *gin.Context) {
	deviceID, ok := h.parseDeviceID(c)
	if !ok {
		return
	}
	year, _ := strconv.Atoi(c.Query("year"))
	month, _ := strconv.Atoi(c.Query("month"))
	if year == 0 {
		year = time.Now().Year()
	}
	if month == 0 {
		month = int(time.Now().Month())
	}
	txs, err := h.TxStore.ListByDevice(c.Request.Context(), deviceID, saleMonthKey(year, month))
	if err != nil {
		WriteErr(c, err)
		return
	}
	byDay := map[string]*dto.DailySummaryRow{}
	total := 0
	for _, t := range txs {
		d := saleDateToISO(t.SaleDate)
		if _, ok := byDay[d]; !ok {
			byDay[d] = &dto.DailySummaryRow{Date: d}
		}
		byDay[d].Count++
		byDay[d].Sum += t.SellPrice
		total += t.SellPrice
	}
	daily := make([]dto.DailySummaryRow, 0, len(byDay))
	for _, v := range byDay {
		daily = append(daily, *v)
	}
	sort.Slice(daily, func(i, j int) bool { return daily[i].Date < daily[j].Date })
	WriteOK(c, dto.MonthlyReportResponse{Year: year, Month: month, Daily: daily, Total: total, Count: len(txs)})
}

// Resume: GET /reports/resume?year=YYYY
func (h *Report) Resume(c *gin.Context) {
	deviceID, ok := h.parseDeviceID(c)
	if !ok {
		return
	}
	year, _ := strconv.Atoi(c.Query("year"))
	if year == 0 {
		year = time.Now().Year()
	}
	txs, err := h.TxStore.ListByDeviceYear(c.Request.Context(), deviceID, year)
	if err != nil {
		WriteErr(c, err)
		return
	}
	byMonth := map[int]*dto.MonthlySummaryRow{}
	total := 0
	for _, t := range txs {
		m := saleMonthToInt(t.SaleMonth)
		if _, ok := byMonth[m]; !ok {
			byMonth[m] = &dto.MonthlySummaryRow{Month: m}
		}
		byMonth[m].Count++
		byMonth[m].Sum += t.SellPrice
		total += t.SellPrice
	}
	monthly := make([]dto.MonthlySummaryRow, 0, len(byMonth))
	for _, v := range byMonth {
		monthly = append(monthly, *v)
	}
	sort.Slice(monthly, func(i, j int) bool { return monthly[i].Month < monthly[j].Month })
	WriteOK(c, dto.ResumeReportResponse{Year: year, Monthly: monthly, Total: total, Count: len(txs)})
}

// Summary: GET /reports/summary — today + this month KPI counters
func (h *Report) Summary(c *gin.Context) {
	deviceID, ok := h.parseDeviceID(c)
	if !ok {
		return
	}
	ctx := c.Request.Context()
	now := time.Now()
	today := strings.ToLower(now.Format("Jan/02/2006"))
	monthKey := strings.ToLower(now.Format("Jan2006"))

	todayTxs, err := h.TxStore.ListByDeviceDate(ctx, deviceID, today)
	if err != nil {
		WriteErr(c, err)
		return
	}
	monthTxs, err := h.TxStore.ListByDevice(ctx, deviceID, monthKey)
	if err != nil {
		WriteErr(c, err)
		return
	}
	todaySum := 0
	for _, t := range todayTxs {
		todaySum += t.SellPrice
	}
	monthSum := 0
	for _, t := range monthTxs {
		monthSum += t.SellPrice
	}
	WriteOK(c, dto.VoucherDashboardSummary{
		TodayCount: len(todayTxs),
		TodaySum:   todaySum,
		MonthCount: len(monthTxs),
		MonthSum:   monthSum,
	})
}

// ── date helpers ──────────────────────────────────────────────────────────────

// isoToSaleDate mengkonversi "2026-06-04" → "jun/04/2026"
func isoToSaleDate(s string) (string, error) {
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return "", err
	}
	return strings.ToLower(t.Format("Jan/02/2006")), nil
}

// saleMonthKey mengkonversi year=2026, month=6 → "jun2026"
func saleMonthKey(year, month int) string {
	t := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	return strings.ToLower(t.Format("Jan2006"))
}

// saleDateToISO mengkonversi "jun/04/2026" → "2026-06-04"
func saleDateToISO(saleDate string) string {
	// SaleDate disimpan lowercase: "jun/04/2026"; time.Parse butuh title-case
	parts := strings.SplitN(saleDate, "/", 3)
	if len(parts) == 3 {
		titled := strings.Title(parts[0]) + "/" + parts[1] + "/" + parts[2]
		if t, err := time.Parse("Jan/02/2006", titled); err == nil {
			return t.Format("2006-01-02")
		}
	}
	return saleDate
}

// saleMonthToInt mengkonversi "jan2026" → 1, "dec2026" → 12
func saleMonthToInt(s string) int {
	if len(s) < 3 {
		return 0
	}
	t, err := time.Parse("Jan", strings.Title(s[:3]))
	if err != nil {
		return 0
	}
	return int(t.Month())
}

// toVoucherSale memetakan model.Transaction ke dto.VoucherSaleResponse
// dengan field name sesuai kontrak frontend Phase-6.
func toVoucherSale(t model.Transaction, deviceID uint) dto.VoucherSaleResponse {
	soldAt := t.CreatedAt.UTC().Format(time.RFC3339)
	return dto.VoucherSaleResponse{
		ID:             t.ID,
		RouterID:       deviceID,
		SoldAt:         soldAt,
		Username:       t.Username,
		ProfileName:    t.Profile,
		Price:          t.Price,
		SellingPrice:   t.SellPrice,
		Server:         "",
		IPAddress:      t.IP,
		MACAddress:     t.MAC,
		Validity:       t.Validity,
		IdempotencyKey: t.Comment,
		CreatedAt:      soldAt,
	}
}

// errStr adalah helper untuk WriteValidationErr ketika error sederhana
// tidak punya struktur validator (mis. missing path param).
type strErr string

func (e strErr) Error() string { return string(e) }
func errStr(s string) error    { return strErr(s) }
