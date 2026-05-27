package workflows

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/quiqxiq/roslib-mikhmon/domain"
	"github.com/quiqxiq/roslib-mikhmon/mikrotik"
	"github.com/quiqxiq/roslib-mikhmon/mikrotik/hotspot"
	"github.com/quiqxiq/roslib-mikhmon/scripts/onlogin"
)

// OnLoginConfig adalah subset profile_config yang dibutuhkan untuk
// generate body script on-login.
//
// Helper ini sengaja TIDAK import store/model supaya workflows/ tidak
// terikat ke layer persistence — caller mapping field-nya sendiri.
type OnLoginConfig struct {
	ExpiryMode string // "0" | "rem" | "ntf" | "remc" | "ntfc"
	Validity   string // "30d", "1d", dll
	Price      int
	SellPrice  int
	LockMAC    bool
}

// InjectOnLoginScript membangun body script on-login dari cfg + webhook
// URL, lalu push ke profile RouterOS via hotspot.ProfileSet.
//
// Behavior:
//   - cfg.ExpiryMode == "0" → push string kosong (clear on-login). Profile
//     gratis tanpa expiry management.
//   - cfg.ExpiryMode != "0" → build script via onlogin.Build dengan
//     WebhookURL = goServiceURL + "/api/v1/hook/hotspot/login/<deviceID>".
//     Kalau goServiceURL kosong, webhook block tidak di-include
//     (selling record akan di-skip untuk login berikutnya).
//
// Return mikrotik.ErrInvalidArgument kalau profileName kosong, atau
// mikrotik.ErrNotFound kalau profile dengan nama tsb tidak ada di router.
func InjectOnLoginScript(
	ctx context.Context,
	c *Clients,
	profileName string,
	cfg OnLoginConfig,
	deviceID uint,
	goServiceURL string,
) error {
	if profileName == "" {
		return mikrotik.ErrInvalidArgument
	}

	profile, err := c.Hotspot.ProfileByName(ctx, profileName)
	if err != nil {
		if errors.Is(err, mikrotik.ErrNotFound) {
			return fmt.Errorf("workflows.InjectOnLoginScript: profile %q not found on router: %w",
				profileName, err)
		}
		return fmt.Errorf("workflows.InjectOnLoginScript: lookup profile %q: %w",
			profileName, err)
	}

	// Guard: refuse to overwrite profiles owned by bandwidth_profiles.
	if hasTag(profile.Comment, TagBW) {
		return fmt.Errorf("workflows.InjectOnLoginScript: profile %q owned by bandwidth_profile (comment=%q), refuse to inject",
			profileName, profile.Comment)
	}

	var script string
	if cfg.ExpiryMode != string(domain.ModeNone) {
		mode, perr := domain.ParseExpiredMode(cfg.ExpiryMode)
		if perr != nil {
			return fmt.Errorf("workflows.InjectOnLoginScript: %w", perr)
		}
		opts := onlogin.Options{
			Mode:        mode,
			Validity:    cfg.Validity,
			Price:       cfg.Price,
			SellPrice:   cfg.SellPrice,
			LockMAC:     cfg.LockMAC,
			WebhookURL:  buildWebhookURL(goServiceURL, deviceID),
			ProfileName: profileName,
		}
		script = onlogin.Build(opts)
	}

	// Claim ownership marker + set on-login in a single ProfileSet call.
	claim := commentVC(profileName, cfg)
	if err := c.Hotspot.ProfileSet(ctx, hotspot.ProfileSetArgs{
		ID:      profile.ID,
		OnLogin: &script,
		Comment: &claim,
	}); err != nil {
		return fmt.Errorf("workflows.InjectOnLoginScript: set on-login %q: %w",
			profileName, err)
	}
	return nil
}

// buildWebhookURL menghasilkan URL webhook absolut atau "" kalau
// goServiceURL kosong. Format: "<base>/api/v1/hook/hotspot/login/<id>".
//
// Tidak melakukan URL escaping — deviceID adalah uint, base URL
// di-validate di config loader.
func buildWebhookURL(goServiceURL string, deviceID uint) string {
	if goServiceURL == "" {
		return ""
	}
	// Trim trailing slash supaya tidak jadi double-slash.
	for len(goServiceURL) > 0 && goServiceURL[len(goServiceURL)-1] == '/' {
		goServiceURL = goServiceURL[:len(goServiceURL)-1]
	}
	return goServiceURL + "/api/v1/hook/hotspot/login/" + strconv.FormatUint(uint64(deviceID), 10)
}
