package ppp_test

import (
	"strings"
	"testing"
	"time"

	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/mikrotik/ppp"
	"github.com/stretchr/testify/require"
)

func skipIfRace(t *testing.T) {
	t.Helper()
	if testutil.RaceEnabled {
		t.Skip("skip: upstream race in go-routeros v3.0.1 ctxReader (Close vs Cancel)")
	}
}

func TestSecretStream_registerSendsFollowCommand(t *testing.T) {
	skipIfRace(t)
	cs, srv := testutil.NewTestClientSet(t)
	srv.OnStream(tcpmock.MatchCommand("/ppp/secret/print"))

	err := cs.PPP.SecretStream("secret-follow", func(_ ppp.SecretEvent) {})
	require.NoError(t, err)
	t.Cleanup(func() { _ = cs.PPP.StopSecretStream("secret-follow") })

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ppp/secret/print"), "secret follow command")
	require.Contains(t, got, "follow")
}

func TestSecretStream_followOnlySendsFollowOnlyCommand(t *testing.T) {
	skipIfRace(t)
	cs, srv := testutil.NewTestClientSet(t)
	srv.OnStream(tcpmock.MatchCommand("/ppp/secret/print"))

	err := cs.PPP.SecretStreamFollowOnly("secret-follow-only", func(_ ppp.SecretEvent) {})
	require.NoError(t, err)
	t.Cleanup(func() { _ = cs.PPP.StopSecretStream("secret-follow-only") })

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ppp/secret/print"), "secret follow-only command")
	require.Contains(t, got, "follow-only")
}

func awaitStreamTag(t *testing.T, srv *tcpmock.Server, command string, timeout time.Duration) string {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		for _, w := range srv.Received() {
			if len(w) > 0 && w[0] == command {
				for _, word := range w {
					if strings.HasPrefix(word, ".tag=") {
						return word[len(".tag="):]
					}
				}
			}
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("did not see command %s with .tag", command)
	return ""
}
