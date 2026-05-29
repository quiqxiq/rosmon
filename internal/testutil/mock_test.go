package testutil

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestNewMockDevice_loginAndQuery verifikasi NewMockDevice menghasilkan
// device yang dapat menjalankan command sederhana via sub-client hotspot.
func TestNewMockDevice_loginAndQuery(t *testing.T) {
	cs, srv := NewTestClientSet(t)

	// Register handler untuk /ip/hotspot/user/print → balas 1 user lalu !done.
	srv.OnSentence(
		tcpmock.MatchCommand("/ip/hotspot/user/print"),
		tcpmock.UserPrint("1", "alice", "default", "no expiry"),
		tcpmock.DoneReply(),
	)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	users, err := cs.Hot.UserList(ctx)
	require.NoError(t, err)
	require.Len(t, users, 1)
	assert.Equal(t, "alice", users[0].Name)
	assert.Equal(t, "default", users[0].Profile)

	// Mock should have received /login (2× karena dual conn roslib) + /ip/hotspot/user/print.
	srv.AssertReceived(t, tcpmock.MatchCommand("/login"), "login handshake")
	srv.AssertReceived(t, tcpmock.MatchCommand("/ip/hotspot/user/print"), "user list")
}

func TestNewMockDevice_fifoScript_returnsRow(t *testing.T) {
	cs, srv := NewTestClientSet(t)
	srv.Script(
		tcpmock.UserPrint("1", "alice", "default", "no expiry"),
		tcpmock.DoneReply(),
	)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	users, err := cs.Hot.UserList(ctx)
	require.NoError(t, err)
	require.Len(t, users, 1)
	assert.Equal(t, "alice", users[0].Name)
}

func TestNewTestDevMgr_getReturnsClientSet(t *testing.T) {
	mgr, _, dev := NewTestDevMgr(t)
	cs, err := mgr.Get(dev.ID)
	require.NoError(t, err)
	require.NotNil(t, cs)
	assert.Equal(t, uint(1), cs.DeviceID)
}

// Repro: same setup as expiry tests — UserList via mgr.Get(deviceID).
func TestNewTestDevMgr_userListViaMgr(t *testing.T) {
	mgr, srv, dev := NewTestDevMgr(t)
	srv.Script(
		tcpmock.UserPrint("1", "alice", "default", "comment"),
		tcpmock.DoneReply(),
	)

	cs, err := mgr.Get(dev.ID)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	users, err := cs.Hot.UserList(ctx)
	require.NoError(t, err)
	require.Len(t, users, 1)
	assert.Equal(t, "alice", users[0].Name)
}

func TestEventually_succeeds(t *testing.T) {
	var flag atomic.Bool
	go func() {
		time.Sleep(30 * time.Millisecond)
		flag.Store(true)
	}()
	Eventually(t, flag.Load, 500*time.Millisecond, "flag should flip")
}
