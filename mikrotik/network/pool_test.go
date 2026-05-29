package network_test

import (
	"context"
	"testing"
	"time"

	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/mikrotik/network"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

func TestClient_IPPoolByName_Success(t *testing.T) {
	skipIfRace(t)
	net, srv := newNetworkClientWithDelayedReplies(t, "/ip/pool/print",
		tcpmock.ReReply("=.id=*1", "=name=dhcp_pool", "=ranges=192.168.1.2-192.168.1.254", "=total=253", "=used=10", "=available=243"),
		tcpmock.DoneReply(),
	)

	pool, err := net.IPPoolByName(testContext(t), "dhcp_pool")
	require.NoErrorf(t, err, "received=%v", srv.Received())
	require.Equal(t, "*1", pool.ID)
	require.Equal(t, int64(253), pool.Total)
	require.Equal(t, int64(10), pool.Used)
	require.Equal(t, int64(243), pool.Available)

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ip/pool/print"), "pool by name")
	require.Contains(t, got, "?name=dhcp_pool")
}

func TestClient_IPPoolAdd_Success(t *testing.T) {
	skipIfRace(t)
	net, srv := newNetworkClientWithDelayedReplies(t, "/ip/pool/add", tcpmock.DoneReply("=ret=*2"))

	id, err := net.IPPoolAdd(testContext(t), network.IPPoolAddArgs{
		Name:    "pool1",
		Ranges:  "10.0.0.2-10.0.0.254",
		Comment: "mikhmon-it",
	})
	require.NoErrorf(t, err, "received=%v", srv.Received())
	require.Equal(t, "*2", id)

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ip/pool/add"), "pool add")
	require.Contains(t, got, "=name=pool1")
	require.Contains(t, got, "=ranges=10.0.0.2-10.0.0.254")
	require.Contains(t, got, "=comment=mikhmon-it")
}

func TestClient_IPPoolSet_Success(t *testing.T) {
	skipIfRace(t)
	net, srv := newNetworkClientWithDelayedReplies(t, "/ip/pool/set", tcpmock.DoneReply())
	ranges := "10.0.1.2-10.0.1.254"
	comment := "updated"

	err := net.IPPoolSet(testContext(t), network.IPPoolSetArgs{ID: "*2", Ranges: &ranges, Comment: &comment})
	require.NoErrorf(t, err, "received=%v", srv.Received())

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ip/pool/set"), "pool set")
	require.Contains(t, got, "=numbers=*2")
	require.Contains(t, got, "=ranges=10.0.1.2-10.0.1.254")
	require.Contains(t, got, "=comment=updated")
}

func TestClient_IPPoolRemove_Success(t *testing.T) {
	skipIfRace(t)
	net, srv := newNetworkClientWithDelayedReplies(t, "/ip/pool/remove", tcpmock.DoneReply())

	err := net.IPPoolRemove(testContext(t), "*2")
	require.NoErrorf(t, err, "received=%v", srv.Received())

	got := srv.AssertReceived(t, tcpmock.MatchCommand("/ip/pool/remove"), "pool remove")
	require.Contains(t, got, "=numbers=*2")
}

func newNetworkClientWithDelayedReplies(t *testing.T, command string, replies ...[]string) (*network.Client, *tcpmock.Server) {
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
	return network.New(dev), srv
}

func testContext(t *testing.T) context.Context {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	t.Cleanup(cancel)
	return ctx
}
