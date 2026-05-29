package ppp_test

import (
	"context"
	"testing"
	"time"

	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/mikrotik/ppp"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

func TestSecretAdd_sendsLimitBytesArgs(t *testing.T) {
	skipIfRace(t)
	cli, srv := newPPPClientWithReplies(t, "/ppp/secret/add", tcpmock.DoneReply("=ret=*1"))

	id, err := cli.SecretAdd(testCtx(t), ppp.SecretAddArgs{
		Name:          "u01",
		Password:      "pw",
		Service:       "pppoe",
		Profile:       "default",
		LocalAddr:     "10.0.0.1",
		RemoteAddr:    "10.0.0.10",
		LimitBytesIn:  1_000_000,
		LimitBytesOut: 2_000_000,
	})
	require.NoErrorf(t, err, "received=%v", srv.Received())
	require.Equal(t, "*1", id)

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ppp/secret/add"), "secret add")
	require.Contains(t, got, "=name=u01")
	require.Contains(t, got, "=password=pw")
	require.Contains(t, got, "=service=pppoe")
	require.Contains(t, got, "=profile=default")
	require.Contains(t, got, "=local-address=10.0.0.1")
	require.Contains(t, got, "=remote-address=10.0.0.10")
	require.Contains(t, got, "=limit-bytes-in=1000000")
	require.Contains(t, got, "=limit-bytes-out=2000000")
}

func TestSecretAdd_omitZeroLimitBytes(t *testing.T) {
	skipIfRace(t)
	cli, srv := newPPPClientWithReplies(t, "/ppp/secret/add", tcpmock.DoneReply("=ret=*1"))

	_, err := cli.SecretAdd(testCtx(t), ppp.SecretAddArgs{Name: "u02"})
	require.NoError(t, err)

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ppp/secret/add"), "secret add zero")
	require.Contains(t, got, "=name=u02")
	require.NotContains(t, got, "=limit-bytes-in=")
	require.NotContains(t, got, "=limit-bytes-out=")
}

func TestSecretSet_sendsLimitBytesPointerArgs(t *testing.T) {
	skipIfRace(t)
	cli, srv := newPPPClientWithReplies(t, "/ppp/secret/set", tcpmock.DoneReply())
	zero := int64(0)
	in := int64(5_000_000)

	err := cli.SecretSet(testCtx(t), ppp.SecretSetArgs{
		ID:            "*1",
		LimitBytesIn:  &in,
		LimitBytesOut: &zero, // explicit reset to 0/unlimited
	})
	require.NoError(t, err)

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ppp/secret/set"), "secret set")
	require.Contains(t, got, "=numbers=*1")
	require.Contains(t, got, "=limit-bytes-in=5000000")
	require.Contains(t, got, "=limit-bytes-out=0")
}

func TestSecretByName_parsesLastDisconnectReason(t *testing.T) {
	skipIfRace(t)
	cli, _ := newPPPClientWithReplies(t, "/ppp/secret/print",
		tcpmock.ReReply(
			"=.id=*5",
			"=name=alice",
			"=service=pppoe",
			"=profile=vip",
			"=last-logged-out=may/20/2026 10:00:00",
			"=last-caller-id=AA:BB:CC:DD:EE:FF",
			"=last-disconnect-reason=user-request",
			"=disabled=false",
		),
		tcpmock.DoneReply(),
	)

	sec, err := cli.SecretByName(testCtx(t), "alice")
	require.NoError(t, err)
	require.Equal(t, "alice", sec.Name)
	require.Equal(t, "user-request", sec.LastDisconnectReason)
	require.Equal(t, "AA:BB:CC:DD:EE:FF", sec.LastCallerID)
	require.Equal(t, "may/20/2026 10:00:00", sec.LastLoggedOut)
	require.False(t, sec.Disabled)
}

func newPPPClientWithReplies(t *testing.T, command string, replies ...[]string) (*ppp.Client, *tcpmock.Server) {
	t.Helper()
	srv, err := tcpmock.Start()
	require.NoError(t, err)
	srv.AcceptLogin()
	srv.OnSentenceFunc(tcpmock.MatchCommand(command), func(_ []string) [][]string {
		time.Sleep(10 * time.Millisecond)
		return replies
	})

	log := logrus.New()
	log.SetLevel(logrus.WarnLevel)
	ctx, cancel := context.WithCancel(context.Background())
	dev, err := roslib.New(ctx, roslib.Options{
		Address:     srv.Addr(),
		Username:    "test",
		Password:    "test",
		Logger:      log,
		DialTimeout: 2 * time.Second,
	})
	require.NoError(t, err)

	t.Cleanup(func() { _ = srv.Close() })
	t.Cleanup(cancel)
	t.Cleanup(func() { _ = dev.CloseAndWait() })
	return ppp.New(dev), srv
}

func testCtx(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	t.Cleanup(cancel)
	return ctx
}
