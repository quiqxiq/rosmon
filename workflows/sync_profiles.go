package workflows

import (
	"context"
	"errors"
	"fmt"

	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
)

// ProfileSyncResult adalah ringkasan hasil SyncProfiles per kategori.
type ProfileSyncResult struct {
	Synced       []string
	Created      []string
	Orphan       []string
	Injected     []string
	InjectFailed []string
}

// SyncProfiles menarik semua hotspot profile dari router lalu reconcile
// dengan tabel hotspot_profiles (role='voucher'). Untuk profile yang ada
// di DB dengan ExpiryMode != "0", on-login script di-inject ke router.
//
// Flow:
//  1. List profile router (c.Hotspot.ProfileList).
//  2. List voucher profiles dari DB (store.ListByDevice, role=voucher).
//  3. Untuk tiap profile router:
//     a. Sudah di DB? → Synced (skip update, jangan timpa price/mode).
//     b. Belum di DB? → Insert default {ExpiryMode:"0"}, Created.
//  4. Untuk tiap DB profile → cek ada di router?
//     a. Tidak ada → Orphan.
//     b. Ada DAN ExpiryMode != "0" → InjectOnLoginScript (best-effort).
func SyncProfiles(
	ctx context.Context,
	c *Clients,
	s store.HotspotProfileStore,
	deviceID uint,
	goServiceURL string,
) (ProfileSyncResult, error) {
	result := ProfileSyncResult{}

	routerProfiles, err := c.Hotspot.ProfileList(ctx)
	if err != nil {
		return result, fmt.Errorf("workflows.SyncProfiles: list router profiles: %w", err)
	}

	dbProfiles, err := s.ListByDevice(ctx, deviceID, store.HotspotProfileListFilter{Role: "voucher"})
	if err != nil {
		return result, fmt.Errorf("workflows.SyncProfiles: list db profiles: %w", err)
	}

	// Index DB by profile name for O(1) lookup.
	dbByName := make(map[string]model.HotspotProfile, len(dbProfiles))
	for _, p := range dbProfiles {
		dbByName[p.Name] = p
	}

	routerNames := make(map[string]struct{}, len(routerProfiles))

	// Step 3: insert new profiles, mark existing.
	for _, rp := range routerProfiles {
		if rp.Name == "" {
			continue
		}
		routerNames[rp.Name] = struct{}{}

		if _, exists := dbByName[rp.Name]; exists {
			result.Synced = append(result.Synced, rp.Name)
			continue
		}

		newP := &model.HotspotProfile{
			DeviceID:   deviceID,
			Name:       rp.Name,
			Role:       "voucher",
			ExpiryMode: "0",
		}
		if _, err := s.Upsert(ctx, newP); err != nil {
			return result, fmt.Errorf("workflows.SyncProfiles: upsert %q: %w", rp.Name, err)
		}
		result.Created = append(result.Created, rp.Name)
	}

	// Step 4: detect orphan + inject on-login for non-zero expiry mode.
	for _, p := range dbProfiles {
		if _, exists := routerNames[p.Name]; !exists {
			result.Orphan = append(result.Orphan, p.Name)
			continue
		}
		if err := InjectOnLoginScript(ctx, c, p.Name,
			toOnLoginConfig(p), deviceID, goServiceURL); err != nil {
			result.InjectFailed = append(result.InjectFailed,
				fmt.Sprintf("%s: %v", p.Name, errUnwrap(err)))
			continue
		}
		result.Injected = append(result.Injected, p.Name)
	}

	return result, nil
}

func toOnLoginConfig(p model.HotspotProfile) OnLoginConfig {
	return OnLoginConfig{
		ExpiryMode: p.ExpiryMode,
		Validity:   p.Validity,
		Price:      p.Price,
		SellPrice:  p.SellPrice,
		LockMAC:    p.LockMAC,
	}
}

func errUnwrap(err error) error {
	for {
		inner := errors.Unwrap(err)
		if inner == nil {
			return err
		}
		err = inner
	}
}
