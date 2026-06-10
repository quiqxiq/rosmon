package job

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/quiqxiq/rosmon/service/audit"
	"github.com/quiqxiq/rosmon/service/notification"
	"github.com/quiqxiq/rosmon/store"
	"github.com/sirupsen/logrus"
)

// SuspensionCheckJob berjalan harian 09:00. Langkah:
//  0. Reminder H-2: invoice issued yang jatuh tempo dalam 2 hari → invoice_reminder.
//  1. Mark overdue: invoice issued yang sudah lewat due_date → invoice_overdue.
//  2. Isolir: subscription active dengan invoice overdue >= isolir_after_days → service_isolir.
//  3. Hard suspend: subscription dengan invoice overdue >= hard_suspend_after_days → service_suspended.
//
// Perubahan status hanya ke DB. Outbox goroutine yang mengeksekusi ke MikroTik.
// Notifikasi best-effort lewat service/notification.
type SuspensionCheckJob struct {
	SubStore     store.SubscriptionStore
	CustStore    store.CustomerStore
	InvStore     store.InvoiceStore
	SettingStore store.SettingStore
	Notification *notification.Service
	AuditLog     store.AuditLogStore // nil-safe: audit tidak ditulis jika nil
	NowFunc      func() time.Time    // injectable untuk test; nil = time.Now
	Log          *logrus.Logger
}

func NewSuspensionCheckJob(
	sub store.SubscriptionStore,
	cust store.CustomerStore,
	inv store.InvoiceStore,
	settings store.SettingStore,
	notif *notification.Service,
	auditLog store.AuditLogStore,
	nowFunc func() time.Time,
	log *logrus.Logger,
) *SuspensionCheckJob {
	if log == nil {
		log = logrus.New()
	}
	if nowFunc == nil {
		nowFunc = time.Now
	}
	return &SuspensionCheckJob{
		SubStore: sub, CustStore: cust, InvStore: inv,
		SettingStore: settings, Notification: notif,
		AuditLog: auditLog, NowFunc: nowFunc, Log: log,
	}
}

func (j *SuspensionCheckJob) Run(ctx context.Context) error {
	now := j.NowFunc()

	isolirAfter := j.settingInt(ctx, "billing.isolir_after_days", 3)
	hardSuspendAfter := j.settingInt(ctx, "billing.hard_suspend_after_days", 14)

	// Step 0: Reminder H-2 (best-effort).
	j.sendReminders(ctx, now)

	// Step 1: Mark overdue — invoices with due_date < today and status=issued.
	overdueInvoices, err := j.InvStore.ListOverdue(ctx, now)
	if err != nil {
		return fmt.Errorf("suspension_check: list overdue: %w", err)
	}

	isolirCandidates := map[uint]bool{}  // subscription_id → should isolir
	suspendCandidates := map[uint]bool{} // subscription_id → should suspend

	for _, inv := range overdueInvoices {
		// Mark invoice overdue + notifikasi.
		if inv.Status == "issued" {
			if err := j.InvStore.UpdateStatus(ctx, inv.ID, "overdue", nil); err != nil {
				j.Log.WithError(err).WithField("invoice_id", inv.ID).Warn("suspension_check: mark overdue failed")
			} else {
				notifyCustomer(ctx, j.Notification, j.CustStore, j.SettingStore, inv.CustomerID, "invoice_overdue", map[string]string{
					"invoice_number": inv.InvoiceNumber,
					"amount":         formatRupiah(inv.Amount),
					"due_date":       inv.DueDate.Format("02 Jan 2006"),
				})
			}
		}

		daysPastDue := int(now.Sub(inv.DueDate).Hours() / 24)

		if daysPastDue >= hardSuspendAfter {
			suspendCandidates[inv.SubscriptionID] = true
		} else if daysPastDue >= isolirAfter {
			isolirCandidates[inv.SubscriptionID] = true
		}
	}

	// Step 2: Isolir candidates (skip those already targeted for suspend).
	for subID := range isolirCandidates {
		if suspendCandidates[subID] {
			continue
		}
		sub, err := j.SubStore.Get(ctx, subID)
		if err != nil || sub.Status != "active" {
			continue
		}
		if err := j.SubStore.UpdateStatus(ctx, subID, "isolir", nil, nil); err != nil {
			j.Log.WithError(err).WithField("subscription_id", subID).Warn("suspension_check: isolir failed")
			continue
		}
		if err := j.SubStore.UpdateSyncStatus(ctx, subID, "pending_profile_change", "auto-isolir: overdue invoice"); err != nil {
			j.Log.WithError(err).WithField("subscription_id", subID).Warn("suspension_check: set sync_status failed")
		}
		audit.Log(ctx, j.AuditLog, j.Log, nil, "subscription_status_changed", "subscription", subID,
			map[string]string{"status": sub.Status}, map[string]string{"status": "isolir", "trigger": "auto-isolir: overdue invoice"})
		notifyCustomer(ctx, j.Notification, j.CustStore, j.SettingStore, sub.CustomerID, "service_isolir", nil)
		j.Log.WithField("subscription_id", subID).Info("suspension_check: isolir applied")
	}

	// Step 3: Hard suspend candidates.
	for subID := range suspendCandidates {
		sub, err := j.SubStore.Get(ctx, subID)
		if err != nil {
			continue
		}
		if sub.Status != "active" && sub.Status != "isolir" {
			continue
		}
		if err := j.SubStore.UpdateStatus(ctx, subID, "suspended", nil, nil); err != nil {
			j.Log.WithError(err).WithField("subscription_id", subID).Warn("suspension_check: suspend failed")
			continue
		}
		if err := j.SubStore.UpdateSyncStatus(ctx, subID, "pending_disable", "auto-suspend: overdue invoice"); err != nil {
			j.Log.WithError(err).WithField("subscription_id", subID).Warn("suspension_check: set sync_status failed")
		}
		audit.Log(ctx, j.AuditLog, j.Log, nil, "subscription_status_changed", "subscription", subID,
			map[string]string{"status": sub.Status}, map[string]string{"status": "suspended", "trigger": "auto-suspend: overdue invoice"})
		notifyCustomer(ctx, j.Notification, j.CustStore, j.SettingStore, sub.CustomerID, "service_suspended", nil)
		j.Log.WithField("subscription_id", subID).Info("suspension_check: suspended applied")
	}

	j.Log.WithFields(logrus.Fields{
		"overdue": len(overdueInvoices),
		"isolir":  len(isolirCandidates),
		"suspend": len(suspendCandidates),
	}).Info("suspension_check: done")
	return nil
}

// sendReminders mengirim invoice_reminder untuk invoice issued yang jatuh
// tempo H-2.
func (j *SuspensionCheckJob) sendReminders(ctx context.Context, now time.Time) {
	if j.Notification == nil {
		return
	}
	target := now.AddDate(0, 0, 2)
	invs, err := j.InvStore.ListDueForBilling(ctx, target)
	if err != nil {
		j.Log.WithError(err).Warn("suspension_check: list reminders failed")
		return
	}
	for _, inv := range invs {
		select {
		case <-ctx.Done():
			return
		default:
		}
		notifyCustomer(ctx, j.Notification, j.CustStore, j.SettingStore, inv.CustomerID, "invoice_reminder", map[string]string{
			"invoice_number": inv.InvoiceNumber,
			"amount":         formatRupiah(inv.Amount),
			"due_date":       inv.DueDate.Format("02 Jan 2006"),
		})
	}
}

func (j *SuspensionCheckJob) settingInt(ctx context.Context, key string, def int) int {
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
