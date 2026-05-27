package workflows

import (
	"context"
	"errors"
	"fmt"

	"github.com/quiqxiq/roslib-mikhmon/store"
	"github.com/quiqxiq/roslib-mikhmon/store/model"
)

// ProfileSyncResult adalah ringkasan hasil SyncProfiles per kategori.
//
// Synced: profile router yang sudah ada di DB → tidak diubah (operator
//	sudah customize price/mode-nya, jangan timpa).
// Created: profile router yang BELUM ada di DB → di-insert dengan
//	default ExpiryMode="0" (operator perlu PUT untuk set price/mode).
// Orphan: profile_config di DB yang nama-nya sudah tidak ada lagi di
//	router. Tidak dihapus otomatis — biar operator yang putuskan
//	(via DELETE endpoint kalau memang sudah tidak dipakai).
// Injected: profile yang on-login script-nya berhasil di-push.
// InjectFailed: profile yang gagal di-inject (logged, bukan fatal).
type ProfileSyncResult struct {
	Synced       []string
	Created      []string
	Orphan       []string
	Injected     []string
	InjectFailed []string
	Skipped      []string
}

// SyncProfiles menarik semua hotspot profile dari router lalu reconcile
// dengan tabel hotspot_profile_configs. Untuk profile yang ada di DB
// dengan ExpiryMode != "0", on-login script di-inject ke router.
//
// Flow:
//  1. List profile router (c.Hotspot.ProfileList).
//  2. List config DB (store.ListByDevice).
//  3. Untuk tiap profile router:
//     a. Sudah di DB? → Synced (skip update, jangan timpa price/mode).
//     b. Belum di DB? → Insert default {ExpiryMode:"0", Validity:"", Price:0}, Created.
//  4. Untuk tiap config DB → cek ada di router?
//     a. Tidak ada → Orphan.
//     b. Ada DAN ExpiryMode != "0" → InjectOnLoginScript (best-effort).
//
// Error fatal hanya pada step 1-2 (tidak bisa list). Error pada inject
// di-collect ke InjectFailed dan tidak menggagalkan operasi keseluruhan.
func SyncProfiles(
	ctx context.Context,
	c *Clients,
	store store.ProfileConfigStore,
	deviceID uint,
	goServiceURL string,
) (ProfileSyncResult, error) {
	result := ProfileSyncResult{}

	routerProfiles, err := c.Hotspot.ProfileList(ctx)
	if err != nil {
		return result, fmt.Errorf("workflows.SyncProfiles: list router profiles: %w", err)
	}

	dbConfigs, err := store.ListByDevice(ctx, deviceID)
	if err != nil {
		return result, fmt.Errorf("workflows.SyncProfiles: list db configs: %w", err)
	}

	// Index DB by profile name untuk lookup O(1).
	dbByName := make(map[string]model.HotspotProfileConfig, len(dbConfigs))
	for _, cfg := range dbConfigs {
		dbByName[cfg.ProfileName] = cfg
	}

	// Index router by name untuk deteksi orphan + comment check.
	routerNames := make(map[string]struct{}, len(routerProfiles))
	routerComments := make(map[string]string, len(routerProfiles))

	// Step 3: insert profile baru, tandai existing. Skip bw-owned profiles.
	for _, rp := range routerProfiles {
		if rp.Name == "" {
			continue
		}
		// Skip profiles owned by bandwidth_profiles.
		if hasTag(rp.Comment, TagBW) {
			result.Skipped = append(result.Skipped, rp.Name+" (bandwidth)")
			continue
		}
		routerNames[rp.Name] = struct{}{}
		routerComments[rp.Name] = rp.Comment

		if _, exists := dbByName[rp.Name]; exists {
			result.Synced = append(result.Synced, rp.Name)
			continue
		}

		newCfg := &model.HotspotProfileConfig{
			DeviceID:    deviceID,
			ProfileName: rp.Name,
			ExpiryMode:  "0",
			Validity:    "",
			Price:       0,
			SellPrice:   0,
			LockMAC:     false,
		}
		if err := store.Upsert(ctx, newCfg); err != nil {
			return result, fmt.Errorf("workflows.SyncProfiles: upsert %q: %w", rp.Name, err)
		}
		result.Created = append(result.Created, rp.Name)
	}

	// Step 4: deteksi orphan + inject on-login script untuk yang non-zero.
	for _, cfg := range dbConfigs {
		if _, exists := routerNames[cfg.ProfileName]; !exists {
			result.Orphan = append(result.Orphan, cfg.ProfileName)
			continue
		}
		// Skip if router profile was claimed by bandwidth_profiles.
		if comment := routerComments[cfg.ProfileName]; hasTag(comment, TagBW) {
			result.Skipped = append(result.Skipped, cfg.ProfileName+" (bw-claimed)")
			continue
		}
		if cfg.ExpiryMode == "0" {
			// Free profile — clear on-login (idempotent).
			if err := InjectOnLoginScript(ctx, c, cfg.ProfileName,
				toOnLoginConfig(cfg), deviceID, goServiceURL); err != nil {
				result.InjectFailed = append(result.InjectFailed,
					fmt.Sprintf("%s: %v", cfg.ProfileName, err))
				continue
			}
			result.Injected = append(result.Injected, cfg.ProfileName)
			continue
		}

		if err := InjectOnLoginScript(ctx, c, cfg.ProfileName,
			toOnLoginConfig(cfg), deviceID, goServiceURL); err != nil {
			// Inject failure tidak fatal — kumpulkan ke list dan lanjut.
			result.InjectFailed = append(result.InjectFailed,
				fmt.Sprintf("%s: %v", cfg.ProfileName, errUnwrap(err)))
			continue
		}
		result.Injected = append(result.Injected, cfg.ProfileName)
	}

	return result, nil
}

// toOnLoginConfig mapping model → OnLoginConfig (subset yang dipakai
// generator script). Dipisah supaya workflow logic tidak terikat
// langsung ke struct GORM.
func toOnLoginConfig(cfg model.HotspotProfileConfig) OnLoginConfig {
	return OnLoginConfig{
		ExpiryMode: cfg.ExpiryMode,
		Validity:   cfg.Validity,
		Price:      cfg.Price,
		SellPrice:  cfg.SellPrice,
		LockMAC:    cfg.LockMAC,
	}
}

// errUnwrap mengembalikan inner-most error untuk laporan ringkas.
// SyncProfiles agregasi banyak inject failure, jadi pesan errornya tidak
// perlu mengandung wrapping prefix berkali-kali.
func errUnwrap(err error) error {
	for {
		inner := errors.Unwrap(err)
		if inner == nil {
			return err
		}
		err = inner
	}
}
