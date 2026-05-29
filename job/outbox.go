// Package job berisi background jobs: outbox sync, billing cron, suspension check.
package job

import (
	"context"
	"errors"
	"time"

	"github.com/quiqxiq/rosmon/mikrotik"
	"github.com/quiqxiq/rosmon/mikrotik/hotspot"
	"github.com/quiqxiq/rosmon/mikrotik/ppp"
	"github.com/quiqxiq/rosmon/service/devmgr"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
)

const outboxBatchSize = 20
const outboxSyncTimeout = 10 * time.Second

// OutboxJob memproses subscriptions dengan sync_status != 'synced' dan
// mengeksekusi perintah MikroTik yang sesuai. Idempotent — aman dijalankan ulang.
type OutboxJob struct {
	SubStore      store.SubscriptionStore
	PPPStore      store.PPPProfileStore
	HotspotStore  store.HotspotProfileStore
	SettingStore  store.SettingStore
	DevMgr        *devmgr.Manager
	Log           *logrus.Logger
}

func NewOutboxJob(sub store.SubscriptionStore, ppp store.PPPProfileStore, hs store.HotspotProfileStore, settings store.SettingStore, dm *devmgr.Manager, log *logrus.Logger) *OutboxJob {
	if log == nil {
		log = logrus.New()
	}
	return &OutboxJob{SubStore: sub, PPPStore: ppp, HotspotStore: hs, SettingStore: settings, DevMgr: dm, Log: log}
}

// Start spawns a goroutine that processes the outbox every 10 seconds.
func (j *OutboxJob) Start(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(10 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := j.Run(ctx); err != nil {
					j.Log.WithError(err).Warn("outbox: run error")
				}
			}
		}
	}()
}

func (j *OutboxJob) Run(ctx context.Context) error {
	subs, err := j.SubStore.ListPendingSync(ctx, outboxBatchSize)
	if err != nil {
		return err
	}
	for _, sub := range subs {
		sub := sub
		if err := j.applySync(ctx, sub); err != nil {
			j.Log.WithError(err).WithFields(logrus.Fields{
				"subscription_id": sub.ID,
				"sync_status":     sub.SyncStatus,
			}).Warn("outbox: sync failed")
			_ = j.SubStore.UpdateSyncStatus(ctx, sub.ID, "error", err.Error())
		} else {
			_ = j.SubStore.UpdateSyncStatus(ctx, sub.ID, "synced", "")
		}
	}
	return nil
}

func (j *OutboxJob) applySync(ctx context.Context, sub model.Subscription) error {
	if j.DevMgr == nil {
		return nil
	}
	cs, err := j.DevMgr.Get(sub.DeviceID)
	if err != nil {
		return nil // device offline — will retry next tick
	}

	ctx, cancel := context.WithTimeout(ctx, outboxSyncTimeout)
	defer cancel()

	switch sub.SyncStatus {
	case "pending_create":
		return j.doCreate(ctx, cs, sub)
	case "pending_profile_change":
		return j.doProfileChange(ctx, cs, sub)
	case "pending_disable":
		return j.doDisable(ctx, cs, sub, true)
	case "pending_enable":
		return j.doEnable(ctx, cs, sub)
	case "pending_delete":
		return j.doRemove(ctx, cs, sub)
	}
	return nil
}

func (j *OutboxJob) normalProfile(ctx context.Context, sub model.Subscription) string {
	switch sub.ServiceType {
	case "pppoe":
		if sub.PPPProfileID != nil && j.PPPStore != nil {
			if p, err := j.PPPStore.Get(ctx, *sub.PPPProfileID); err == nil {
				return p.Name
			}
		}
	case "hotspot":
		if sub.HotspotProfileID != nil && j.HotspotStore != nil {
			if p, err := j.HotspotStore.Get(ctx, *sub.HotspotProfileID); err == nil {
				return p.Name
			}
		}
	}
	return ""
}

func (j *OutboxJob) isolirProfile(ctx context.Context) string {
	if j.SettingStore != nil {
		if v, err := j.SettingStore.Get(ctx, "billing.isolir_profile_name"); err == nil && v != "" {
			return v
		}
	}
	return "isolir"
}

func (j *OutboxJob) doCreate(ctx context.Context, cs *devmgr.ClientSet, sub model.Subscription) error {
	profile := j.normalProfile(ctx, sub)
	disabled := false
	switch sub.ServiceType {
	case "pppoe":
		_, err := cs.PPP.SecretAdd(ctx, ppp.SecretAddArgs{
			Name: sub.MikrotikUsername, Password: sub.MikrotikPassword,
			Service: "pppoe", Profile: profile, Disabled: &disabled,
		})
		return err
	case "hotspot":
		_, err := cs.Hot.UserAdd(ctx, hotspot.UserAddArgs{
			Name: sub.MikrotikUsername, Password: sub.MikrotikPassword,
			Profile: profile, Server: "all", Disabled: &disabled,
		})
		return err
	}
	return nil
}

func (j *OutboxJob) doProfileChange(ctx context.Context, cs *devmgr.ClientSet, sub model.Subscription) error {
	var targetProfile string
	switch sub.Status {
	case "isolir":
		targetProfile = j.isolirProfile(ctx)
	default:
		targetProfile = j.normalProfile(ctx, sub)
	}
	switch sub.ServiceType {
	case "pppoe":
		rs, err := cs.PPP.SecretByName(ctx, sub.MikrotikUsername)
		if errors.Is(err, mikrotik.ErrNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		return cs.PPP.SecretSet(ctx, ppp.SecretSetArgs{ID: rs.ID, Profile: targetProfile})
	case "hotspot":
		ru, err := cs.Hot.UserByName(ctx, sub.MikrotikUsername)
		if errors.Is(err, mikrotik.ErrNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		return cs.Hot.UserSet(ctx, hotspot.UserSetArgs{ID: ru.ID, Profile: targetProfile})
	}
	return nil
}

func (j *OutboxJob) doDisable(ctx context.Context, cs *devmgr.ClientSet, sub model.Subscription, disabled bool) error {
	switch sub.ServiceType {
	case "pppoe":
		rs, err := cs.PPP.SecretByName(ctx, sub.MikrotikUsername)
		if errors.Is(err, mikrotik.ErrNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		return cs.PPP.SecretSetDisabled(ctx, rs.ID, disabled)
	case "hotspot":
		ru, err := cs.Hot.UserByName(ctx, sub.MikrotikUsername)
		if errors.Is(err, mikrotik.ErrNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		return cs.Hot.UserSetDisabled(ctx, ru.ID, disabled)
	}
	return nil
}

func (j *OutboxJob) doEnable(ctx context.Context, cs *devmgr.ClientSet, sub model.Subscription) error {
	// Enable = disable(false) + restore profile to normal.
	if err := j.doProfileChange(ctx, cs, sub); err != nil {
		return err
	}
	return j.doDisable(ctx, cs, sub, false)
}

func (j *OutboxJob) doRemove(ctx context.Context, cs *devmgr.ClientSet, sub model.Subscription) error {
	switch sub.ServiceType {
	case "pppoe":
		rs, err := cs.PPP.SecretByName(ctx, sub.MikrotikUsername)
		if errors.Is(err, mikrotik.ErrNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		return cs.PPP.SecretRemove(ctx, rs.ID)
	case "hotspot":
		ru, err := cs.Hot.UserByName(ctx, sub.MikrotikUsername)
		if errors.Is(err, mikrotik.ErrNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		return cs.Hot.UserRemove(ctx, ru.ID)
	}
	return nil
}
