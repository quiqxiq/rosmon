package store

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/quiqxiq/rosmon/store/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrSubscriptionNotFound        = errors.New("store: subscription not found")
	ErrSubscriptionUsernameTaken   = errors.New("store: mikrotik_username already used on this device")
	ErrSubscriptionInvalidStatus   = errors.New("store: invalid subscription status")
)

// SubscriptionListFilter optional filter. Field nol = tidak filter.
type SubscriptionListFilter struct {
	CustomerID  uint
	DeviceID    uint
	Status      string
	ServiceType string
}

// ChurnEntry adalah jumlah subscription terminated per bulan.
type ChurnEntry struct {
	Year  int
	Month int
	Count int
}

// SubscriptionStatusCounts adalah jumlah subscription per status.
type SubscriptionStatusCounts struct {
	Active    int
	Isolir    int
	Suspended int
}

type SubscriptionStore interface {
	List(ctx context.Context, f SubscriptionListFilter) ([]model.Subscription, error)
	Get(ctx context.Context, id uint) (model.Subscription, error)
	Create(ctx context.Context, s *model.Subscription) error
	Update(ctx context.Context, s *model.Subscription) error
	UpdateStatus(ctx context.Context, id uint, status string, activatedAt, terminatedAt *time.Time) error
	UpdateSyncStatus(ctx context.Context, id uint, syncStatus, syncNotes string) error
	// IncrSyncRetry menambah sync_retry_count +1 dan menyimpan sync_notes.
	// Tidak mengubah sync_status — biarkan status tetap pending_* agar outbox
	// masih bisa retry. Mengembalikan nilai retry count terbaru.
	IncrSyncRetry(ctx context.Context, id uint, notes string) (retryCount int, err error)
	// ResetSyncRetry mereset sync_retry_count ke 0. Dipanggil saat sync berhasil.
	ResetSyncRetry(ctx context.Context, id uint) error
	// ListPendingSync returns rows where sync_status != 'synced', up to limit,
	// using FOR UPDATE SKIP LOCKED to avoid double-processing by concurrent workers.
	ListPendingSync(ctx context.Context, limit int) ([]model.Subscription, error)
	// UpdateNextInvoiceDate performs a targeted single-column update — dipakai
	// billing_cron untuk menghindari Save partial yang menimpa field lain.
	UpdateNextInvoiceDate(ctx context.Context, id uint, next time.Time) error
	Delete(ctx context.Context, id uint) error
	// ChurnByMonth mengembalikan jumlah subscription terminated per bulan untuk tahun tertentu.
	ChurnByMonth(ctx context.Context, year int) ([]ChurnEntry, error)
	// StatusCounts mengembalikan jumlah subscription per status aktif.
	StatusCounts(ctx context.Context) (*SubscriptionStatusCounts, error)
	// CountCustomers mengembalikan total customer aktif.
	CountCustomers(ctx context.Context) (int, error)
}

type gormSubscriptionStore struct{ db *gorm.DB }

func NewSubscriptionStore(db *gorm.DB) SubscriptionStore {
	return &gormSubscriptionStore{db: db}
}

// decryptSubscriptions decrypt MikrotikPassword pada setiap row.
func decryptSubscriptions(ss []model.Subscription) ([]model.Subscription, error) {
	for i := range ss {
		p, err := decryptSecret(ss[i].MikrotikPassword)
		if err != nil {
			return nil, err
		}
		ss[i].MikrotikPassword = p
	}
	return ss, nil
}

func (s *gormSubscriptionStore) List(ctx context.Context, f SubscriptionListFilter) ([]model.Subscription, error) {
	q := s.db.WithContext(ctx).Order("created_at DESC")
	if f.CustomerID != 0 {
		q = q.Where("customer_id = ?", f.CustomerID)
	}
	if f.DeviceID != 0 {
		q = q.Where("device_id = ?", f.DeviceID)
	}
	if f.Status != "" {
		q = q.Where("status = ?", f.Status)
	}
	if f.ServiceType != "" {
		q = q.Where("service_type = ?", f.ServiceType)
	}
	var out []model.Subscription
	if err := q.Find(&out).Error; err != nil {
		return nil, err
	}
	return decryptSubscriptions(out)
}

func (s *gormSubscriptionStore) Get(ctx context.Context, id uint) (model.Subscription, error) {
	var sub model.Subscription
	err := s.db.WithContext(ctx).First(&sub, id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return sub, ErrSubscriptionNotFound
	}
	if err != nil {
		return sub, err
	}
	p, decErr := decryptSecret(sub.MikrotikPassword)
	if decErr != nil {
		return sub, decErr
	}
	sub.MikrotikPassword = p
	return sub, nil
}

func (s *gormSubscriptionStore) Create(ctx context.Context, sub *model.Subscription) error {
	enc, err := encryptSecret(sub.MikrotikPassword)
	if err != nil {
		return err
	}
	orig := sub.MikrotikPassword
	sub.MikrotikPassword = enc
	if sub.Status == "" {
		sub.Status = "pending_install"
	}
	if err := s.db.WithContext(ctx).Create(sub).Error; err != nil {
		sub.MikrotikPassword = orig
		if isSubscriptionUniqueErr(err) {
			return ErrSubscriptionUsernameTaken
		}
		return err
	}
	sub.MikrotikPassword = orig
	return nil
}

func (s *gormSubscriptionStore) Update(ctx context.Context, sub *model.Subscription) error {
	enc, err := encryptSecret(sub.MikrotikPassword)
	if err != nil {
		return err
	}
	orig := sub.MikrotikPassword
	sub.MikrotikPassword = enc
	// Pakai Save supaya nullable timestamp (activated_at, terminated_at)
	// dapat di-set ke nil maupun nilai konkret.
	err = s.db.WithContext(ctx).Save(sub).Error
	sub.MikrotikPassword = orig
	if err != nil {
		if isSubscriptionUniqueErr(err) {
			return ErrSubscriptionUsernameTaken
		}
		return err
	}
	return nil
}

func (s *gormSubscriptionStore) UpdateStatus(ctx context.Context, id uint, status string, activatedAt, terminatedAt *time.Time) error {
	updates := map[string]any{
		"status":     status,
		"updated_at": time.Now(),
	}
	if activatedAt != nil {
		updates["activated_at"] = *activatedAt
	}
	if terminatedAt != nil {
		updates["terminated_at"] = *terminatedAt
	}
	if status == "active" {
		today := time.Now().Truncate(24 * time.Hour)
		updates["next_invoice_date"] = gorm.Expr("COALESCE(next_invoice_date, ?)", today)
	}
	res := s.db.WithContext(ctx).Model(&model.Subscription{}).Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrSubscriptionNotFound
	}
	return nil
}

func (s *gormSubscriptionStore) UpdateSyncStatus(ctx context.Context, id uint, syncStatus, syncNotes string) error {
	updates := map[string]any{
		"sync_status": syncStatus,
		"sync_notes":  syncNotes,
		"updated_at":  time.Now(),
	}
	// Reset retry counter saat berhasil sync.
	if syncStatus == "synced" {
		updates["sync_retry_count"] = 0
	}
	res := s.db.WithContext(ctx).Model(&model.Subscription{}).Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrSubscriptionNotFound
	}
	return nil
}

func (s *gormSubscriptionStore) IncrSyncRetry(ctx context.Context, id uint, notes string) (int, error) {
	res := s.db.WithContext(ctx).Model(&model.Subscription{}).Where("id = ?", id).Updates(map[string]any{
		"sync_retry_count": gorm.Expr("sync_retry_count + 1"),
		"sync_notes":       notes,
		"updated_at":       time.Now(),
	})
	if res.Error != nil {
		return 0, res.Error
	}
	if res.RowsAffected == 0 {
		return 0, ErrSubscriptionNotFound
	}
	// Baca kembali nilai terbaru.
	var sub model.Subscription
	if err := s.db.WithContext(ctx).Select("sync_retry_count").First(&sub, id).Error; err != nil {
		return 0, err
	}
	return sub.SyncRetryCount, nil
}

func (s *gormSubscriptionStore) ResetSyncRetry(ctx context.Context, id uint) error {
	return s.db.WithContext(ctx).Model(&model.Subscription{}).Where("id = ?", id).Updates(map[string]any{
		"sync_retry_count": 0,
		"updated_at":       time.Now(),
	}).Error
}

func (s *gormSubscriptionStore) ListPendingSync(ctx context.Context, limit int) ([]model.Subscription, error) {
	var out []model.Subscription
	// Gunakan clause.Locking (GORM v2) — Set("gorm:query_option") adalah API GORM v1 dan diabaikan.
	// Filter juga status='error' dari query: subscription yang gagal sync tidak di-retry
	// otomatis oleh outbox — butuh reconcile manual oleh operator.
	err := s.db.WithContext(ctx).
		Where("sync_status NOT IN ?", []string{"synced", "error"}).
		Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).
		Limit(limit).
		Find(&out).Error
	if err != nil {
		return nil, err
	}
	return decryptSubscriptions(out)
}

func (s *gormSubscriptionStore) UpdateNextInvoiceDate(ctx context.Context, id uint, next time.Time) error {
	res := s.db.WithContext(ctx).Model(&model.Subscription{}).Where("id = ?", id).Updates(map[string]any{
		"next_invoice_date": next,
		"updated_at":        time.Now(),
	})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrSubscriptionNotFound
	}
	return nil
}

func (s *gormSubscriptionStore) Delete(ctx context.Context, id uint) error {
	res := s.db.WithContext(ctx).Delete(&model.Subscription{}, id)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return ErrSubscriptionNotFound
	}
	return nil
}

func (s *gormSubscriptionStore) ChurnByMonth(ctx context.Context, year int) ([]ChurnEntry, error) {
	type row struct {
		Month int
		Count int
	}
	var rows []row
	err := s.db.WithContext(ctx).
		Model(&model.Subscription{}).
		Select("EXTRACT(MONTH FROM terminated_at) as month, COUNT(*) as count").
		Where("EXTRACT(YEAR FROM terminated_at) = ?", year).
		Where("terminated_at IS NOT NULL").
		Group("month").
		Order("month").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]ChurnEntry, len(rows))
	for i, r := range rows {
		out[i] = ChurnEntry{Year: year, Month: r.Month, Count: r.Count}
	}
	return out, nil
}

func (s *gormSubscriptionStore) StatusCounts(ctx context.Context) (*SubscriptionStatusCounts, error) {
	type row struct {
		Status string
		Count  int
	}
	var rows []row
	err := s.db.WithContext(ctx).
		Model(&model.Subscription{}).
		Select("status, COUNT(*) as count").
		Where("status IN ?", []string{"active", "isolir", "suspended"}).
		Group("status").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	sc := &SubscriptionStatusCounts{}
	for _, r := range rows {
		switch r.Status {
		case "active":
			sc.Active = r.Count
		case "isolir":
			sc.Isolir = r.Count
		case "suspended":
			sc.Suspended = r.Count
		}
	}
	return sc, nil
}

func (s *gormSubscriptionStore) CountCustomers(ctx context.Context) (int, error) {
	var count int64
	err := s.db.WithContext(ctx).
		Table("customers").
		Where("deleted_at IS NULL AND status = 'aktif'").
		Count(&count).Error
	return int(count), err
}

func isSubscriptionUniqueErr(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	if strings.Contains(msg, "idx_sub_dev_type_user") {
		return true
	}
	if strings.Contains(msg, "UNIQUE constraint") || strings.Contains(msg, "duplicate key") {
		return true
	}
	return false
}
