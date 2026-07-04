package store

import (
	"context"
	"strconv"
	"time"

	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
)

// defaultTransactionLimit adalah batas maksimal row transaksi yang dikembalikan
// per request tanpa pagination. Cegah OOM pada router dengan history besar.
const defaultTransactionLimit = 500

type TransactionStore interface {
	Create(ctx context.Context, tx *model.Transaction) error
	ListByDevice(ctx context.Context, deviceID uint, month string) ([]model.Transaction, error)
	ListByDeviceDate(ctx context.Context, deviceID uint, date string) ([]model.Transaction, error)
	// ListByDeviceYear mengembalikan semua transaksi device untuk satu tahun
	// kalender. Dipakai endpoint /reports/resume untuk agregasi per-bulan.
	ListByDeviceYear(ctx context.Context, deviceID uint, year int) ([]model.Transaction, error)
	// ListByDateRange mengembalikan transaksi device dalam rentang tanggal (inclusive),
	// dengan filter opsional (profile, search) dan pagination.
	// Returned: slice transaksi, total count untuk pagination, dan total revenue (sum sell_price).
	ListByDateRange(ctx context.Context, deviceID uint, from, to time.Time, profile, search string, page, pageSize int) ([]model.Transaction, int64, int64, error)
	// ExistsByUserComment cek apakah ada transaksi untuk kombinasi
	// (device_id, username, comment) — dipakai webhook handler untuk
	// dedup re-login (hanya first login yang ter-record).
	ExistsByUserComment(ctx context.Context, deviceID uint, username, comment string) (bool, error)
	// ExistsByUserCommentSince cek apakah ada transaksi (device_id, username, comment)
	// yang dibuat SETELAH since. Dipakai dedup re-login berbasis window validity:
	// re-login dalam window yang sama tidak ter-record ganda, tapi pembelian baru
	// (setelah window habis) tetap ter-record.
	ExistsByUserCommentSince(ctx context.Context, deviceID uint, username, comment string, since time.Time) (bool, error)
}

type gormTransactionStore struct{ db *gorm.DB }

func NewTransactionStore(db *gorm.DB) TransactionStore { return &gormTransactionStore{db: db} }

func (s *gormTransactionStore) Create(ctx context.Context, tx *model.Transaction) error {
	return s.db.WithContext(ctx).Create(tx).Error
}

func (s *gormTransactionStore) ListByDevice(ctx context.Context, deviceID uint, month string) ([]model.Transaction, error) {
	var txs []model.Transaction
	q := s.db.WithContext(ctx).Where("device_id = ?", deviceID)
	if month != "" {
		q = q.Where("sale_month = ?", month)
	}
	err := q.Order("created_at desc").Limit(defaultTransactionLimit).Find(&txs).Error
	return txs, err
}

func (s *gormTransactionStore) ListByDeviceDate(ctx context.Context, deviceID uint, date string) ([]model.Transaction, error) {
	var txs []model.Transaction
	err := s.db.WithContext(ctx).
		Where("device_id = ? AND sale_date = ?", deviceID, date).
		Order("created_at desc").Limit(defaultTransactionLimit).Find(&txs).Error
	return txs, err
}

// ListByDateRange mengambil transaksi dalam rentang created_at [from, to],
// dengan filter profile/search opsional, dan pagination (page 1-based).
func (s *gormTransactionStore) ListByDateRange(
	ctx context.Context, deviceID uint,
	from, to time.Time,
	profile, search string,
	page, pageSize int,
) ([]model.Transaction, int64, int64, error) {
	buildQ := func() *gorm.DB {
		q := s.db.WithContext(ctx).Model(&model.Transaction{}).
			Where("device_id = ? AND created_at >= ? AND created_at <= ?", deviceID, from, to)
		if profile != "" {
			q = q.Where("profile = ?", profile)
		}
		if search != "" {
			q = q.Where("username ILIKE ?", "%"+search+"%")
		}
		return q
	}

	var total int64
	if err := buildQ().Count(&total).Error; err != nil {
		return nil, 0, 0, err
	}

	var revenue struct {
		Total int64
	}
	if total > 0 {
		if err := buildQ().Select("COALESCE(SUM(sell_price), 0) as total").Scan(&revenue).Error; err != nil {
			return nil, 0, 0, err
		}
	}

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 25
	}
	offset := (page - 1) * pageSize

	var txs []model.Transaction
	err := buildQ().Order("created_at desc").Limit(pageSize).Offset(offset).Find(&txs).Error
	return txs, total, revenue.Total, err
}

func (s *gormTransactionStore) ListByDeviceYear(ctx context.Context, deviceID uint, year int) ([]model.Transaction, error) {
	var txs []model.Transaction
	err := s.db.WithContext(ctx).
		Where("device_id = ? AND sale_month LIKE ?", deviceID, "%"+strconv.Itoa(year)).
		Order("sale_month asc, created_at asc").
		Limit(defaultTransactionLimit * 12).
		Find(&txs).Error
	return txs, err
}

func (s *gormTransactionStore) ExistsByUserComment(
	ctx context.Context, deviceID uint, username, comment string,
) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).
		Model(&model.Transaction{}).
		Where("device_id = ? AND username = ? AND comment = ?", deviceID, username, comment).
		Limit(1).
		Count(&count).Error
	return count > 0, err
}

func (s *gormTransactionStore) ExistsByUserCommentSince(
	ctx context.Context, deviceID uint, username, comment string, since time.Time,
) (bool, error) {
	var count int64
	err := s.db.WithContext(ctx).
		Model(&model.Transaction{}).
		Where("device_id = ? AND username = ? AND comment = ? AND created_at > ?",
			deviceID, username, comment, since).
		Limit(1).
		Count(&count).Error
	return count > 0, err
}
