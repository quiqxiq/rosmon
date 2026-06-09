package store

import (
	"context"
	"errors"
	"time"

	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
)

var ErrInvoiceNotFound = errors.New("store: invoice not found")

type InvoiceListFilter struct {
	CustomerID     uint
	SubscriptionID uint
	Status         string
	// Year + Month memfilter berdasarkan bulan PERIODE tagihan (period_start).
	// Keduanya harus >0 untuk aktif (konsisten dengan MonthlySummary).
	Year  int
	Month int
}

// FinancialSummary adalah hasil agregasi invoice per bulan untuk laporan keuangan.
type FinancialSummary struct {
	TotalBilled    int64
	TotalCollected int64
	InvoiceCount   int
	PaidCount      int
	OverdueCount   int
}

// AgingBucket adalah satu bucket aging invoice overdue.
type AgingBucket struct {
	Label       string
	Count       int
	TotalAmount int64
}

type InvoiceStore interface {
	Create(ctx context.Context, inv *model.Invoice, items []model.InvoiceItem) error
	GetByID(ctx context.Context, id uint) (*model.Invoice, error)
	// GetByPaymentCode mencari invoice via kode pembayaran unik (settle-by-code).
	GetByPaymentCode(ctx context.Context, code string) (*model.Invoice, error)
	List(ctx context.Context, f InvoiceListFilter) ([]model.Invoice, error)
	UpdateStatus(ctx context.Context, id uint, status string, paidAt *time.Time) error
	// ListDueForBilling returns active-status invoices with due_date == today (for billing cron).
	ListDueForBilling(ctx context.Context, date time.Time) ([]model.Invoice, error)
	// ListOverdue returns issued invoices with due_date before cutoff.
	ListOverdue(ctx context.Context, cutoff time.Time) ([]model.Invoice, error)
	// MonthlySummary mengembalikan agregasi invoice untuk bulan dan tahun yang diberikan.
	MonthlySummary(ctx context.Context, year, month int) (*FinancialSummary, error)
	// AgingBuckets mengembalikan distribusi aging invoice overdue per bucket.
	AgingBuckets(ctx context.Context, asOf time.Time) ([]AgingBucket, error)
	// CountOverdue mengembalikan jumlah dan total amount invoice overdue.
	CountOverdue(ctx context.Context) (count int, totalAmount int64, err error)
	// SumPaidThisMonth mengembalikan total amount invoice paid pada bulan & tahun ini.
	SumPaidThisMonth(ctx context.Context, year, month int) (int64, error)
	// CountPendingPayments mengembalikan jumlah payment berstatus pending.
	CountPendingPayments(ctx context.Context) (int, error)
}

type gormInvoiceStore struct{ db *gorm.DB }

func NewInvoiceStore(db *gorm.DB) InvoiceStore {
	return &gormInvoiceStore{db: db}
}

func (s *gormInvoiceStore) Create(ctx context.Context, inv *model.Invoice, items []model.InvoiceItem) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(inv).Error; err != nil {
			return err
		}
		for i := range items {
			items[i].InvoiceID = inv.ID
		}
		if len(items) > 0 {
			return tx.Create(&items).Error
		}
		return nil
	})
}

func (s *gormInvoiceStore) GetByID(ctx context.Context, id uint) (*model.Invoice, error) {
	var inv model.Invoice
	err := s.db.WithContext(ctx).First(&inv, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrInvoiceNotFound
	}
	return &inv, err
}

func (s *gormInvoiceStore) GetByPaymentCode(ctx context.Context, code string) (*model.Invoice, error) {
	if code == "" {
		return nil, ErrInvoiceNotFound
	}
	var inv model.Invoice
	err := s.db.WithContext(ctx).Where("payment_code = ?", code).First(&inv).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrInvoiceNotFound
	}
	return &inv, err
}

func (s *gormInvoiceStore) List(ctx context.Context, f InvoiceListFilter) ([]model.Invoice, error) {
	q := s.db.WithContext(ctx).Order("created_at DESC")
	if f.CustomerID != 0 {
		q = q.Where("customer_id = ?", f.CustomerID)
	}
	if f.SubscriptionID != 0 {
		q = q.Where("subscription_id = ?", f.SubscriptionID)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.Year > 0 && f.Month > 0 {
		q = q.Where("EXTRACT(YEAR FROM period_start) = ? AND EXTRACT(MONTH FROM period_start) = ?", f.Year, f.Month)
	}
	var out []model.Invoice
	return out, q.Find(&out).Error
}

func (s *gormInvoiceStore) UpdateStatus(ctx context.Context, id uint, status string, paidAt *time.Time) error {
	updates := map[string]any{
		"status":     status,
		"updated_at": time.Now(),
	}
	if paidAt != nil {
		updates["paid_at"] = *paidAt
	}
	if status == "issued" {
		now := time.Now()
		updates["issued_at"] = now
	}
	res := s.db.WithContext(ctx).Model(&model.Invoice{}).Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrInvoiceNotFound
	}
	return nil
}

func (s *gormInvoiceStore) ListDueForBilling(ctx context.Context, date time.Time) ([]model.Invoice, error) {
	var out []model.Invoice
	err := s.db.WithContext(ctx).
		Where("DATE(due_date) = DATE(?) AND status = ?", date, "issued").
		Find(&out).Error
	return out, err
}

func (s *gormInvoiceStore) ListOverdue(ctx context.Context, cutoff time.Time) ([]model.Invoice, error) {
	var out []model.Invoice
	err := s.db.WithContext(ctx).
		Where("due_date < ? AND status IN ?", cutoff, []string{"issued", "overdue"}).
		Find(&out).Error
	return out, err
}

func (s *gormInvoiceStore) MonthlySummary(ctx context.Context, year, month int) (*FinancialSummary, error) {
	type row struct {
		Status string
		Count  int
		Total  int64
	}
	var rows []row
	err := s.db.WithContext(ctx).
		Model(&model.Invoice{}).
		Select("status, COUNT(*) as count, COALESCE(SUM(amount),0) as total").
		Where("EXTRACT(YEAR FROM period_start) = ? AND EXTRACT(MONTH FROM period_start) = ?", year, month).
		Where("status IN ?", []string{"issued", "paid", "overdue"}).
		Group("status").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	fs := &FinancialSummary{}
	for _, r := range rows {
		fs.InvoiceCount += r.Count
		fs.TotalBilled += r.Total
		switch r.Status {
		case "paid":
			fs.PaidCount = r.Count
			fs.TotalCollected = r.Total
		case "overdue":
			fs.OverdueCount = r.Count
		}
	}
	return fs, nil
}

func (s *gormInvoiceStore) AgingBuckets(ctx context.Context, asOf time.Time) ([]AgingBucket, error) {
	// Hitung batas tanggal di Go, lalu query per-bucket.
	// Menghindari CASE kompleks dengan type mismatch di PostgreSQL.
	cut7 := asOf.AddDate(0, 0, -7)
	cut14 := asOf.AddDate(0, 0, -14)
	cut30 := asOf.AddDate(0, 0, -30)

	type row struct {
		Count int
		Total int64
	}
	query := func(from, to time.Time) (int, int64, error) {
		var r row
		q := s.db.WithContext(ctx).
			Model(&model.Invoice{}).
			Select("COUNT(*) as count, COALESCE(SUM(amount),0) as total").
			Where("status IN ?", []string{"issued", "overdue"}).
			Where("due_date < ?", asOf)
		if !from.IsZero() {
			q = q.Where("due_date >= ?", from)
		}
		if !to.IsZero() {
			q = q.Where("due_date < ?", to)
		}
		err := q.Scan(&r).Error
		return r.Count, r.Total, err
	}

	buckets := []struct {
		label    string
		from, to time.Time
	}{
		{"0-7 hari", cut7, asOf},
		{"8-14 hari", cut14, cut7},
		{"15-30 hari", cut30, cut14},
		{">30 hari", time.Time{}, cut30},
	}

	out := make([]AgingBucket, 0, len(buckets))
	for _, b := range buckets {
		cnt, total, err := query(b.from, b.to)
		if err != nil {
			return nil, err
		}
		if cnt > 0 {
			out = append(out, AgingBucket{Label: b.label, Count: cnt, TotalAmount: total})
		}
	}
	return out, nil
}

func (s *gormInvoiceStore) CountOverdue(ctx context.Context) (int, int64, error) {
	type res struct {
		Count int
		Total int64
	}
	var r res
	err := s.db.WithContext(ctx).
		Model(&model.Invoice{}).
		Select("COUNT(*) as count, COALESCE(SUM(amount),0) as total").
		Where("status IN ?", []string{"overdue", "issued"}).
		Where("due_date < ?", time.Now()).
		Scan(&r).Error
	return r.Count, r.Total, err
}

func (s *gormInvoiceStore) SumPaidThisMonth(ctx context.Context, year, month int) (int64, error) {
	var total int64
	err := s.db.WithContext(ctx).
		Model(&model.Invoice{}).
		Select("COALESCE(SUM(amount),0)").
		Where("status = 'paid'").
		Where("EXTRACT(YEAR FROM paid_at) = ? AND EXTRACT(MONTH FROM paid_at) = ?", year, month).
		Scan(&total).Error
	return total, err
}

func (s *gormInvoiceStore) CountPendingPayments(ctx context.Context) (int, error) {
	var count int64
	err := s.db.WithContext(ctx).
		Table("payments").
		Where("status = 'pending'").
		Count(&count).Error
	return int(count), err
}
