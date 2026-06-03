package job

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/quiqxiq/rosmon/mikrotik"
	"github.com/quiqxiq/rosmon/service/audit"
	"github.com/quiqxiq/rosmon/service/devmgr"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
)

// ReconcilerJob mendeteksi drift antara DB dan router MikroTik.
// Berjalan setiap jam — membandingkan expected state (dari DB) dengan actual
// state (dari router), dan men-set sync_status ke pending_* agar outbox
// otomatis memperbaikinya. Drift hanya dicatat, tidak langsung dieksekusi.
type ReconcilerJob struct {
	SubStore  store.SubscriptionStore
	AuditLog  store.AuditLogStore
	DevMgr    *devmgr.Manager
	Log       *logrus.Logger
}

func NewReconcilerJob(
	sub store.SubscriptionStore,
	auditLog store.AuditLogStore,
	dm *devmgr.Manager,
	log *logrus.Logger,
) *ReconcilerJob {
	if log == nil {
		log = logrus.New()
	}
	return &ReconcilerJob{SubStore: sub, AuditLog: auditLog, DevMgr: dm, Log: log}
}

// Start spawns a goroutine that runs every hour.
func (j *ReconcilerJob) Start(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := j.Run(ctx); err != nil {
					j.Log.WithError(err).Warn("reconciler: run error")
				}
			}
		}
	}()
}

const reconcilerBatchSize = 50

// Run adalah entry point reconciler. Idempotent.
func (j *ReconcilerJob) Run(ctx context.Context) error {
	if j.DevMgr == nil {
		return nil
	}
	j.Log.Info("reconciler: start")

	// Ambil subscription yang seharusnya aktif di router dan sudah synced.
	subs, err := j.SubStore.List(ctx, store.SubscriptionListFilter{})
	if err != nil {
		return fmt.Errorf("reconciler: list subscriptions: %w", err)
	}

	driftCount := 0
	for _, sub := range subs {
		sub := sub
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		// Hanya proses subscription yang expected ada di router dan sudah synced.
		if sub.SyncStatus != "synced" {
			continue
		}
		switch sub.Status {
		case "active", "isolir", "suspended":
		default:
			continue // pending_install/terminated tidak perlu dicek
		}

		if drift := j.checkDrift(ctx, sub); drift != "" {
			driftCount++
			j.Log.WithFields(logrus.Fields{
				"subscription_id":   sub.ID,
				"service_type":      sub.ServiceType,
				"mikrotik_username": sub.MikrotikUsername,
				"drift":             drift,
			}).Warn("reconciler: drift detected")

			// Mark pending_profile_change → outbox akan reconcile.
			_ = j.SubStore.UpdateSyncStatus(ctx, sub.ID, "pending_profile_change",
				"reconciler detected drift: "+drift)

			audit.Log(ctx, j.AuditLog, j.Log, nil, "reconciler_drift", "subscription", sub.ID,
				nil, map[string]string{"drift": drift})
		}
	}

	j.Log.WithField("drift_count", driftCount).Info("reconciler: done")
	return nil
}

// checkDrift memeriksa apakah state subscription di router sesuai dengan yang
// diharapkan di DB. Mengembalikan string deskripsi drift, atau "" jika oke.
func (j *ReconcilerJob) checkDrift(ctx context.Context, sub model.Subscription) string {
	cs, err := j.DevMgr.Get(sub.DeviceID)
	if err != nil {
		return "" // device offline — skip, bukan drift
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	switch sub.ServiceType {
	case "pppoe":
		return j.checkPPPDrift(ctx, cs, sub)
	case "hotspot":
		return j.checkHotspotDrift(ctx, cs, sub)
	}
	return ""
}

func (j *ReconcilerJob) checkPPPDrift(ctx context.Context, cs *devmgr.ClientSet, sub model.Subscription) string {
	secret, err := cs.PPP.SecretByName(ctx, sub.MikrotikUsername)
	if errors.Is(err, mikrotik.ErrNotFound) {
		if sub.Status == "active" || sub.Status == "isolir" {
			return "ppp secret missing on router"
		}
		return ""
	}
	if err != nil {
		return "" // timeout atau error koneksi — bukan drift definitif
	}

	expectedDisabled := sub.Status == "suspended"
	if secret.Disabled != expectedDisabled {
		return fmt.Sprintf("disabled mismatch: router=%v expected=%v", secret.Disabled, expectedDisabled)
	}
	return ""
}

func (j *ReconcilerJob) checkHotspotDrift(ctx context.Context, cs *devmgr.ClientSet, sub model.Subscription) string {
	user, err := cs.Hot.UserByName(ctx, sub.MikrotikUsername)
	if errors.Is(err, mikrotik.ErrNotFound) {
		if sub.Status == "active" || sub.Status == "isolir" {
			return "hotspot user missing on router"
		}
		return ""
	}
	if err != nil {
		return ""
	}

	expectedDisabled := sub.Status == "suspended"
	if user.Disabled != expectedDisabled {
		return fmt.Sprintf("disabled mismatch: router=%v expected=%v", user.Disabled, expectedDisabled)
	}
	return ""
}
