package job

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/quiqxiq/rosmon/store"
	"github.com/sirupsen/logrus"
)

// SuspensionCheckJob berjalan harian 09:00. Tiga langkah:
//  1. Mark overdue: invoice issued yang sudah lewat due_date.
//  2. Isolir: subscription active yang punya invoice overdue >= isolir_after_days.
//  3. Hard suspend: subscription active/isolir yang punya invoice overdue >= hard_suspend_after_days.
//
// Perubahan status hanya ke DB. Outbox goroutine yang mengeksekusi ke MikroTik.
type SuspensionCheckJob struct {
	SubStore     store.SubscriptionStore
	InvStore     store.InvoiceStore
	SettingStore store.SettingStore
	Log          *logrus.Logger
}

func NewSuspensionCheckJob(sub store.SubscriptionStore, inv store.InvoiceStore, settings store.SettingStore, log *logrus.Logger) *SuspensionCheckJob {
	if log == nil {
		log = logrus.New()
	}
	return &SuspensionCheckJob{SubStore: sub, InvStore: inv, SettingStore: settings, Log: log}
}

func (j *SuspensionCheckJob) Run(ctx context.Context) error {
	now := time.Now()

	isolirAfter := j.settingInt(ctx, "billing.isolir_after_days", 3)
	hardSuspendAfter := j.settingInt(ctx, "billing.hard_suspend_after_days", 14)

	// Step 1: Mark overdue — invoices with due_date < today and status=issued.
	overdueInvoices, err := j.InvStore.ListOverdue(ctx, now)
	if err != nil {
		return fmt.Errorf("suspension_check: list overdue: %w", err)
	}

	isolirCandidates := map[uint]bool{}  // subscription_id → should isolir
	suspendCandidates := map[uint]bool{} // subscription_id → should suspend

	for _, inv := range overdueInvoices {
		// Mark invoice overdue.
		if inv.Status == "issued" {
			if err := j.InvStore.UpdateStatus(ctx, inv.ID, "overdue", nil); err != nil {
				j.Log.WithError(err).WithField("invoice_id", inv.ID).Warn("suspension_check: mark overdue failed")
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
		j.Log.WithField("subscription_id", subID).Info("suspension_check: suspended applied")
	}

	j.Log.WithFields(logrus.Fields{
		"overdue":  len(overdueInvoices),
		"isolir":   len(isolirCandidates),
		"suspend":  len(suspendCandidates),
	}).Info("suspension_check: done")
	return nil
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
