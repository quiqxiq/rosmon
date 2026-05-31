// Package billing menghasilkan invoice langganan. Dipakai oleh
// job/billing_cron (penagihan bulanan anniversary) dan alur registrasi
// (invoice pertama saat instalasi selesai). Logika resolve harga paket +
// penomoran invoice terpusat di sini agar tidak terduplikasi.
package billing

import (
	"context"
	"fmt"
	"time"

	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
)

// Deps adalah dependency Service. NowFunc injectable untuk test.
type Deps struct {
	Invoices  store.InvoiceStore
	Sequences store.SequenceStore
	PPP       store.PPPProfileStore
	Hotspot   store.HotspotProfileStore
	NowFunc   func() time.Time
}

type Service struct{ d Deps }

func New(d Deps) *Service {
	if d.NowFunc == nil {
		d.NowFunc = time.Now
	}
	return &Service{d: d}
}

// GenerateForSubscription membuat satu invoice berstatus "issued" untuk
// periode yang dimulai periodStart. Idempoten via UNIQUE(subscription_id,
// period_start) di tabel invoices. dueDays = jumlah hari sampai jatuh tempo.
func (s *Service) GenerateForSubscription(ctx context.Context, sub model.Subscription, periodStart time.Time, dueDays int) (*model.Invoice, error) {
	profileName, price, err := s.resolveProfileInfo(ctx, sub)
	if err != nil {
		return nil, fmt.Errorf("billing: resolve profile: %w", err)
	}

	now := s.d.NowFunc()
	seq, err := s.d.Sequences.NextVal(ctx, "INV", now.Year(), int(now.Month()))
	if err != nil {
		return nil, fmt.Errorf("billing: next sequence: %w", err)
	}
	invNumber := s.d.Sequences.FormatNumber("INV", now.Year(), int(now.Month()), seq)

	periodEnd := periodStart.AddDate(0, 1, -1)
	dueDate := periodStart.AddDate(0, 0, dueDays)
	issuedAt := now

	inv := &model.Invoice{
		InvoiceNumber:  invNumber,
		CustomerID:     sub.CustomerID,
		SubscriptionID: sub.ID,
		Amount:         price,
		PeriodStart:    periodStart,
		PeriodEnd:      periodEnd,
		DueDate:        dueDate,
		Status:         "issued",
		IssuedAt:       &issuedAt,
		PaymentCode:    store.NewPaymentCode(),
	}
	item := model.InvoiceItem{
		Description: fmt.Sprintf("Langganan %s periode %s – %s",
			profileName, periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02")),
		Quantity:  1,
		UnitPrice: price,
		Amount:    price,
	}
	if err := s.d.Invoices.Create(ctx, inv, []model.InvoiceItem{item}); err != nil {
		return nil, err
	}
	return inv, nil
}

// resolveProfileInfo mengambil nama profil + harga bulanan sesuai service_type.
func (s *Service) resolveProfileInfo(ctx context.Context, sub model.Subscription) (name string, price int64, err error) {
	switch sub.ServiceType {
	case "pppoe":
		if sub.PPPProfileID == nil {
			return "", 0, fmt.Errorf("subscription %d has no ppp_profile_id", sub.ID)
		}
		p, e := s.d.PPP.Get(ctx, *sub.PPPProfileID)
		if e != nil {
			return "", 0, fmt.Errorf("get ppp profile: %w", e)
		}
		return p.Name, p.PriceMonthly, nil
	case "hotspot":
		if sub.HotspotProfileID == nil {
			return "", 0, fmt.Errorf("subscription %d has no hotspot_profile_id", sub.ID)
		}
		p, e := s.d.Hotspot.Get(ctx, *sub.HotspotProfileID)
		if e != nil {
			return "", 0, fmt.Errorf("get hotspot profile: %w", e)
		}
		return p.Name, p.PriceMonthly, nil
	}
	return "", 0, fmt.Errorf("unknown service_type: %s", sub.ServiceType)
}
