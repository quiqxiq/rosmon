package hotspot_test

import (
	"testing"

	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/mikrotik/hotspot"
	"github.com/stretchr/testify/require"
)

func TestUserListStream_registerSendsFollowCommand(t *testing.T) {
	skipIfRace(t)
	cs, srv := testutil.NewTestClientSet(t)
	srv.OnStream(tcpmock.MatchCommand("/ip/hotspot/user/print"))

	err := cs.Hot.UserListStream("user-list-follow", func(_ hotspot.UserEvent) {})
	require.NoError(t, err)
	t.Cleanup(func() { _ = cs.Hot.StopUserListStream("user-list-follow") })

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ip/hotspot/user/print"), "user list follow command")
	require.Contains(t, got, "follow")
}

func TestUserListStream_followOnlySendsFollowOnlyCommand(t *testing.T) {
	skipIfRace(t)
	cs, srv := testutil.NewTestClientSet(t)
	srv.OnStream(tcpmock.MatchCommand("/ip/hotspot/user/print"))

	err := cs.Hot.UserListStreamFollowOnly("user-list-follow-only", func(_ hotspot.UserEvent) {})
	require.NoError(t, err)
	t.Cleanup(func() { _ = cs.Hot.StopUserListStream("user-list-follow-only") })

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ip/hotspot/user/print"), "user list follow-only command")
	require.Contains(t, got, "follow-only")
}
