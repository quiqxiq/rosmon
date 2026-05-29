package job

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
)

// BillingCronJob generate invoice bulanan untuk semua subscription aktif
// yang next_invoice_date = hari ini. Idempotent: UNIQUE (subscription_id, period_start)
// di tabel invoices mencegah duplikat.
type BillingCronJob struct {
	SubStore     store.SubscriptionStore
	PPPStore     store.PPPProfileStore
	HotspotStore store.HotspotProfileStore
	InvStore     store.InvoiceStore
	SeqStore     store.SequenceStore
	SettingStore store.SettingStore
	Log          *logrus.Logger
}

func NewBillingCronJob(sub store.SubscriptionStore, ppp store.PPPProfileStore, hs store.HotspotProfileStore, inv store.InvoiceStore, seq store.SequenceStore, settings store.SettingStore, log *logrus.Logger) *BillingCronJob {
	if log == nil {
		log = logrus.New()
	}
	return &BillingCronJob{SubStore: sub, PPPStore: ppp, HotspotStore: hs, InvStore: inv, SeqStore: seq, SettingStore: settings, Log: log}
}

func (j *BillingCronJob) Run(ctx context.Context) error {
	today := time.Now().Truncate(24 * time.Hour)

	// Load settings.
	dueDays := j.settingInt(ctx, "billing.invoice_due_days", 7)

	// Query active subscriptions due for billing today.
	subs, err := j.SubStore.List(ctx, store.SubscriptionListFilter{Status: "active"})
	if err != nil {
		return fmt.Errorf("billing_cron: list subscriptions: %w", err)
	}

	generated := 0
	for _, sub := range subs {
		if sub.NextInvoiceDate == nil {
			continue
		}
		dueDate := sub.NextInvoiceDate.Truncate(24 * time.Hour)
		if !dueDate.Equal(today) {
			continue
		}
		if err := j.generateInvoice(ctx, sub, today, dueDays); err != nil {
			j.Log.WithError(err).WithField("subscription_id", sub.ID).Warn("billing_cron: generate invoice failed")
			continue
		}
		generated++

		// Advance next_invoice_date by 1 month.
		next := sub.NextInvoiceDate.AddDate(0, 1, 0)
		if err := j.SubStore.Update(ctx, &model.Subscription{
			ID:              sub.ID,
			NextInvoiceDate: &next,
		}); err != nil {
			j.Log.WithError(err).WithField("subscription_id", sub.ID).Warn("billing_cron: update next_invoice_date failed")
		}
	}

	j.Log.WithField("generated", generated).Info("billing_cron: done")
	return nil
}

func (j *BillingCronJob) generateInvoice(ctx context.Context, sub model.Subscription, periodStart time.Time, dueDays int) error {
	profileName, priceMonthly, err := j.resolveProfileInfo(ctx, sub)
	if err != nil {
		return fmt.Errorf("resolve profile: %w", err)
	}

	now := time.Now()
	seq, err := j.SeqStore.NextVal(ctx, "INV", now.Year(), int(now.Month()))
	if err != nil {
		return fmt.Errorf("next sequence: %w", err)
	}
	invNumber := j.SeqStore.FormatNumber("INV", now.Year(), int(now.Month()), seq)

	periodEnd := periodStart.AddDate(0, 1, -1)
	dueDate := periodStart.AddDate(0, 0, dueDays)
	issuedAt := now

	inv := &model.Invoice{
		InvoiceNumber:  invNumber,
		CustomerID:     sub.CustomerID,
		SubscriptionID: sub.ID,
		Amount:         priceMonthly,
		PeriodStart:    periodStart,
		PeriodEnd:      periodEnd,
		DueDate:        dueDate,
		Status:         "issued",
		IssuedAt:       &issuedAt,
	}
	item := model.InvoiceItem{
		Description: fmt.Sprintf("Langganan %s periode %s – %s",
			profileName, periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02")),
		Quantity:  1,
		UnitPrice: priceMonthly,
		Amount:    priceMonthly,
	}

	return j.InvStore.Create(ctx, inv, []model.InvoiceItem{item})
}

func (j *BillingCronJob) resolveProfileInfo(ctx context.Context, sub model.Subscription) (name string, price int64, err error) {
	switch sub.ServiceType {
	case "pppoe":
		if sub.PPPProfileID == nil {
			return "", 0, fmt.Errorf("subscription %d has no ppp_profile_id", sub.ID)
		}
		p, e := j.PPPStore.Get(ctx, *sub.PPPProfileID)
		if e != nil {
			return "", 0, fmt.Errorf("get ppp profile: %w", e)
		}
		return p.Name, p.PriceMonthly, nil
	case "hotspot":
		if sub.HotspotProfileID == nil {
			return "", 0, fmt.Errorf("subscription %d has no hotspot_profile_id", sub.ID)
		}
		p, e := j.HotspotStore.Get(ctx, *sub.HotspotProfileID)
		if e != nil {
			return "", 0, fmt.Errorf("get hotspot profile: %w", e)
		}
		return p.Name, p.PriceMonthly, nil
	}
	return "", 0, fmt.Errorf("unknown service_type: %s", sub.ServiceType)
}

func (j *BillingCronJob) settingInt(ctx context.Context, key string, def int) int {
	if j.SettingStore == nil {
		return def
	}
	v, err := j.SettingStore.Get(ctx, key)
	if err != nil {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}
