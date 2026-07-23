package dto_test

import (
	"testing"

	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/domain"
	"github.com/stretchr/testify/require"
)

func TestFromDomainPPPSecret_includesNewFields(t *testing.T) {
	src := domain.PPPSecret{
		ID:                   "*1",
		Name:                 "alice",
		Service:              "pppoe",
		Profile:              "vip",
		LocalAddr:            "10.0.0.1",
		RemoteAddr:           "10.0.0.10",
		LimitBytesIn:         1000,
		LimitBytesOut:        2000,
		LastLoggedOut:        "may/20/2026 10:00:00",
		LastCallerID:         "AA:BB:CC:DD:EE:FF",
		LastDisconnectReason: "user-request",
		Disabled:             false,
		Comment:              "vip-cust",
		// dropped fields below should be ignored in DTO
		Password:   "secret",
		CallerID:   "should-not-appear",
		Routes:     "should-not-appear",
		IPv6Routes: "should-not-appear",
	}
	got := dto.FromDomainPPPSecret(src)

	require.Equal(t, "alice", got.Name)
	require.Equal(t, "user-request", got.LastDisconnectReason)
	require.Equal(t, int64(1000), got.LimitBytesIn)
	require.Equal(t, int64(2000), got.LimitBytesOut)
	require.Equal(t, "vip-cust", got.Comment)
}

func TestPPPSecretCreateRequest_ToArgs_mapsLimitBytes(t *testing.T) {
	req := dto.PPPSecretCreateRequest{
		Name:          "u01",
		Password:      "pw",
		LimitBytesIn:  500,
		LimitBytesOut: 1000,
	}
	args := req.ToArgs()
	require.Equal(t, "u01", args.Name)
	require.Equal(t, "pw", args.Password)
	require.Equal(t, int64(500), args.LimitBytesIn)
	require.Equal(t, int64(1000), args.LimitBytesOut)
}

func TestPPPSecretUpdateRequest_ToArgs_sparsePointerLimit(t *testing.T) {
	zero := int64(0)
	in := int64(9999)
	req := dto.PPPSecretUpdateRequest{
		LimitBytesIn:  &in,
		LimitBytesOut: &zero,
	}
	args := req.ToArgs("*7")
	require.Equal(t, "*7", args.ID)
	require.NotNil(t, args.LimitBytesIn)
	require.Equal(t, int64(9999), *args.LimitBytesIn)
	require.NotNil(t, args.LimitBytesOut)
	require.Equal(t, int64(0), *args.LimitBytesOut)
}

func TestFromDomainPPPProfile_exposesDisabledAndScripts(t *testing.T) {
	src := domain.PPPProfile{
		ID:             "*9",
		Name:           "vip",
		LocalAddr:      "10.0.0.1",
		RemoteAddr:     "pool-vip",
		RateLimit:      "10M/10M",
		SessionTimeout: "1h30m",
		IdleTimeout:    "10m",
		ParentQueue:    "global",
		OnUp:           ":log info up",
		OnDown:         ":log info down",
		Disabled:       true,
		Comment:        "vip-profile",
		// dropped:
		DNSServer:      "8.8.8.8",
		Bridge:         "br0",
		OnlyOne:        "yes",
		UseCompression: "no",
		UseEncryption:  "no",
		ChangeTCPMSS:   "yes",
	}
	got := dto.FromDomainPPPProfile(src)
	require.True(t, got.Disabled)
	require.Equal(t, "1h30m", got.SessionTimeout)
	require.Equal(t, "10m", got.IdleTimeout)
	require.Equal(t, "global", got.ParentQueue)
	require.Equal(t, ":log info up", got.OnUp)
	require.Equal(t, ":log info down", got.OnDown)
}

func TestRouterPPPProfileCreateRequest_ToArgs_mapsAllFields(t *testing.T) {
	req := dto.RouterPPPProfileCreateRequest{
		Name:           "vip",
		LocalAddr:      "10.0.0.1",
		RemoteAddr:     "pool-vip",
		RateLimit:      "10M/10M",
		SessionTimeout: "1h",
		IdleTimeout:    "5m",
		ParentQueue:    "global",
		OnUp:           ":log info up",
		OnDown:         ":log info down",
		Comment:        "premium",
	}
	args := req.ToArgs()
	require.Equal(t, "vip", args.Name)
	require.Equal(t, "1h", args.SessionTimeout)
	require.Equal(t, "5m", args.IdleTimeout)
	require.Equal(t, "global", args.ParentQueue)
	require.Equal(t, ":log info up", args.OnUp)
	require.Equal(t, ":log info down", args.OnDown)
}

func TestFromDomainPPPActive_dropsEncodingSessionID(t *testing.T) {
	src := domain.PPPActive{
		ID:        "*1",
		Name:      "alice",
		Service:   "pppoe",
		CallerID:  "AA:BB:CC:DD:EE:FF",
		Address:   "10.0.0.10",
		Uptime:    "1h",
		Encoding:  "MPPE",   // dropped from DTO
		SessionID: "0x1234", // dropped from DTO
	}
	got := dto.FromDomainPPPActive(src)
	require.Equal(t, "alice", got.Name)
	require.Equal(t, "10.0.0.10", got.Address)
	require.Equal(t, "1h", got.Uptime)
}
