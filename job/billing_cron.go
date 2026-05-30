package job

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/quiqxiq/rosmon/service/billing"
	"github.com/quiqxiq/rosmon/service/notification"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
)

// BillingCronJob generate invoice bulanan untuk semua subscription aktif yang
// next_invoice_date = hari ini. Logika pembuatan invoice didelegasikan ke
// service/billing (dipakai juga oleh alur registrasi). Idempotent: UNIQUE
// (subscription_id, period_start) mencegah duplikat. Setelah invoice terbit,
// kirim notifikasi invoice_issued (best-effort).
type BillingCronJob struct {
	SubStore     store.SubscriptionStore
	CustStore    store.CustomerStore
	SettingStore store.SettingStore
	Billing      *billing.Service
	Notification *notification.Service
	Log          *logrus.Logger
}

func NewBillingCronJob(
	sub store.SubscriptionStore,
	cust store.CustomerStore,
	settings store.SettingStore,
	billingSvc *billing.Service,
	notif *notification.Service,
	log *logrus.Logger,
) *BillingCronJob {
	if log == nil {
		log = logrus.New()
	}
	return &BillingCronJob{
		SubStore: sub, CustStore: cust, SettingStore: settings,
		Billing: billingSvc, Notification: notif, Log: log,
	}
}

func (j *BillingCronJob) Run(ctx context.Context) error {
	today := time.Now().Truncate(24 * time.Hour)
	dueDays := j.settingInt(ctx, "billing.invoice_due_days", 7)

	subs, err := j.SubStore.List(ctx, store.SubscriptionListFilter{Status: "active"})
	if err != nil {
		return fmt.Errorf("billing_cron: list subscriptions: %w", err)
	}

	generated := 0
	for _, sub := range subs {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}
		if sub.NextInvoiceDate == nil {
			continue
		}
		if !sub.NextInvoiceDate.Truncate(24 * time.Hour).Equal(today) {
			continue
		}
		inv, err := j.Billing.GenerateForSubscription(ctx, sub, today, dueDays)
		if err != nil {
			j.Log.WithError(err).WithField("subscription_id", sub.ID).Warn("billing_cron: generate invoice failed")
			continue
		}
		generated++

		// Advance next_invoice_date by 1 month.
		next := sub.NextInvoiceDate.AddDate(0, 1, 0)
		if err := j.SubStore.Update(ctx, &model.Subscription{ID: sub.ID, NextInvoiceDate: &next}); err != nil {
			j.Log.WithError(err).WithField("subscription_id", sub.ID).Warn("billing_cron: update next_invoice_date failed")
		}

		// Notifikasi invoice terbit (best-effort, async).
		notifyCustomer(ctx, j.Notification, j.CustStore, j.SettingStore, sub.CustomerID, "invoice_issued", map[string]string{
			"invoice_number": inv.InvoiceNumber,
			"amount":         formatRupiah(inv.Amount),
			"period":         fmt.Sprintf("%s s/d %s", inv.PeriodStart.Format("02 Jan 2006"), inv.PeriodEnd.Format("02 Jan 2006")),
			"due_date":       inv.DueDate.Format("02 Jan 2006"),
		})
	}

	j.Log.WithField("generated", generated).Info("billing_cron: done")
	return nil
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
