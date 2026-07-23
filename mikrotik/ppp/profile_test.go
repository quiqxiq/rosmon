package ppp_test

import (
	"testing"

	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/mikrotik/ppp"
	"github.com/stretchr/testify/require"
)

func TestProfileAdd_sendsAllNewArgs(t *testing.T) {
	skipIfRace(t)
	cli, srv := newPPPClientWithReplies(t, "/ppp/profile/add", tcpmock.DoneReply("=ret=*3"))
	id, err := cli.ProfileAdd(testCtx(t), ppp.ProfileAddArgs{
		Name:           "vip",
		LocalAddr:      "10.0.0.1",
		RemoteAddr:     "pool-vip",
		RateLimit:      "10M/10M",
		SessionTimeout: "1h30m",
		IdleTimeout:    "10m",
		ParentQueue:    "global",
		OnUp:           ":log info up",
		OnDown:         ":log info down",
		Comment:        "premium",
	})
	require.NoErrorf(t, err, "received=%v", srv.Received())
	require.Equal(t, "*3", id)

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ppp/profile/add"), "profile add")
	require.Contains(t, got, "=name=vip")
	require.Contains(t, got, "=local-address=10.0.0.1")
	require.Contains(t, got, "=remote-address=pool-vip")
	require.Contains(t, got, "=rate-limit=10M/10M")
	require.Contains(t, got, "=session-timeout=1h30m")
	require.Contains(t, got, "=idle-timeout=10m")
	require.Contains(t, got, "=parent-queue=global")
	require.Contains(t, got, "=on-up=:log info up")
	require.Contains(t, got, "=on-down=:log info down")
	require.Contains(t, got, "=comment=premium")
}

func TestProfileSet_sparseSendsOnlyProvided(t *testing.T) {
	skipIfRace(t)
	cli, srv := newPPPClientWithReplies(t, "/ppp/profile/set", tcpmock.DoneReply())
	onUp := ":log info"

	err := cli.ProfileSet(testCtx(t), ppp.ProfileSetArgs{
		ID:   "*3",
		OnUp: &onUp,
	})
	require.NoError(t, err)

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ppp/profile/set"), "profile set sparse")
	require.Contains(t, got, "=numbers=*3")
	require.Contains(t, got, "=on-up=:log info")
	require.NotContains(t, got, "=session-timeout=")
	require.NotContains(t, got, "=idle-timeout=")
	require.NotContains(t, got, "=parent-queue=")
	require.NotContains(t, got, "=on-down=")
}

func TestProfileByName_parsesDisabled(t *testing.T) {
	skipIfRace(t)
	cli, _ := newPPPClientWithReplies(t, "/ppp/profile/print",
		tcpmock.ReReply(
			"=.id=*1",
			"=name=default",
			"=rate-limit=5M/5M",
			"=session-timeout=2h",
			"=disabled=true",
		),
		tcpmock.DoneReply(),
	)

	prof, err := cli.ProfileByName(testCtx(t), "default")
	require.NoError(t, err)
	require.Equal(t, "default", prof.Name)
	require.Equal(t, "5M/5M", prof.RateLimit)
	require.Equal(t, "2h", prof.SessionTimeout)
	require.True(t, prof.Disabled)
}
