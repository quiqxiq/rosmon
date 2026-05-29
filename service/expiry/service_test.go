//go:build dbtest

package expiry

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/service/devmgr"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Test ini exercise jalur checkDevice + executeExpiry end-to-end:
//   - postgres testcontainer untuk store seed
//   - tcpmock untuk router replies
//   - white-box test (package expiry) supaya bisa panggil checkDevice
//     yang unexported.

// setupExpiryEnv menyiapkan service + mock + dev model siap di-test.
func setupExpiryEnv(t *testing.T, mode string) (*Service, *tcpmock.Server, model.MikrotikDevice) {
	t.Helper()

	devStore, profStore, txStore := testutil.NewStores(t)
	mgr, srv, dev := testutil.NewTestDevMgr(t)

	// Seed device row (ID harus match dev.ID = 1 dari NewTestDevMgr).
	ctx := context.Background()
	err := devStore.Create(ctx, &dev)
	require.NoError(t, err)

	// Seed profile config dengan mode yang diuji.
	require.NoError(t, profStore.Upsert(ctx, &model.HotspotProfileConfig{
		DeviceID:    dev.ID,
		ProfileName: "default",
		ExpiryMode:  mode,
		Price:       10000,
		SellPrice:   12000,
		Validity:    "30d",
	}))

	log := logrus.New()
	log.SetLevel(logrus.WarnLevel)

	svc := New(mgr, devStore, profStore, txStore, log)
	svc.rootCtx = ctx
	return svc, srv, dev
}

// (note: tests pakai OnSentence matcher-based dispatch supaya cocok
//  per-command-path. Pakai -48h offset untuk margin aman; timezone di-handle
//  via d.TimeZone yang di-pass ke ParseExpiry — test helper pakai time.UTC.)

func TestService_remMode_userDeleted(t *testing.T) {
	svc, srv, dev := setupExpiryEnv(t, "rem")

	past := time.Now().Add(-48 * time.Hour)
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/print"),
		tcpmock.UserPrintExpired("1", "alice", "default", past),
		tcpmock.DoneReply(),
	)
	srv.OnSentence(tcpmock.MatchCommand("/system/script/print"), tcpmock.DoneReply())
	srv.OnSentence(tcpmock.MatchCommand("/system/scheduler/print"), tcpmock.DoneReply())
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/remove"), tcpmock.DoneReply())

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	require.NoError(t, svc.checkDevice(ctx, dev))

	srv.AssertReceived(t, tcpmock.MatchAll(
		tcpmock.MatchCommand("/ip/hotspot/user/remove"),
		tcpmock.MatchHas("numbers", "*1"),
	), "user/remove =numbers=*1")
}

// TestService_remcMode_deletesUser_noRecord memverifikasi bahwa expiry service
// HANYA menghapus user (lifecycle action), TIDAK mencatat transaksi.
// Recording adalah tanggung jawab webhook login handler (hook_login.go).
func TestService_remcMode_deletesUser_noRecord(t *testing.T) {
	svc, srv, dev := setupExpiryEnv(t, "remc")

	past := time.Now().Add(-48 * time.Hour)
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/print"),
		tcpmock.UserPrintExpired("1", "alice", "default", past),
		tcpmock.DoneReply(),
	)
	srv.OnSentence(tcpmock.MatchCommand("/system/script/print"), tcpmock.DoneReply())
	srv.OnSentence(tcpmock.MatchCommand("/system/scheduler/print"), tcpmock.DoneReply())
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/remove"), tcpmock.DoneReply())

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	require.NoError(t, svc.checkDevice(ctx, dev))

	srv.AssertReceived(t, tcpmock.MatchAll(
		tcpmock.MatchCommand("/ip/hotspot/user/remove"),
		tcpmock.MatchHas("numbers", "*1"),
	), "user/remove =numbers=*1")

	// Expiry service tidak boleh insert transaksi — recording adalah tugas webhook.
	month := strings.ToLower(time.Now().Format("Jan2006"))
	txs, err := svc.txStore.ListByDevice(ctx, dev.ID, month)
	require.NoError(t, err)
	assert.Empty(t, txs, "expiry service tidak boleh record transaksi; tanggung jawab webhook")
}

func TestService_ntfMode_setsLimitAndKicks(t *testing.T) {
	svc, srv, dev := setupExpiryEnv(t, "ntf")

	past := time.Now().Add(-48 * time.Hour)
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/print"),
		tcpmock.UserPrintExpired("1", "alice", "default", past),
		tcpmock.DoneReply(),
	)
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/set"), tcpmock.DoneReply())
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/active/print"),
		tcpmock.ActiveLoggedIn("99", "alice", "10.0.0.5", "aa:bb:cc:dd:ee:ff"),
		tcpmock.DoneReply(),
	)
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/active/remove"), tcpmock.DoneReply())

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	require.NoError(t, svc.checkDevice(ctx, dev))

	srv.AssertReceived(t, tcpmock.MatchAll(
		tcpmock.MatchCommand("/ip/hotspot/user/set"),
		tcpmock.MatchHas("limit-uptime", "1s"),
	), "user/set =limit-uptime=1s")
	srv.AssertReceived(t, tcpmock.MatchCommand("/ip/hotspot/active/remove"), "active/remove session")
}

func TestService_ntfMode_noTransactionRecorded(t *testing.T) {
	svc, srv, dev := setupExpiryEnv(t, "ntf")

	past := time.Now().Add(-48 * time.Hour)
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/print"),
		tcpmock.UserPrintExpired("1", "alice", "default", past),
		tcpmock.DoneReply(),
	)
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/set"), tcpmock.DoneReply())
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/active/print"), tcpmock.DoneReply())

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	require.NoError(t, svc.checkDevice(ctx, dev))

	month := strings.ToLower(time.Now().Format("Jan2006"))
	txs, err := svc.txStore.ListByDevice(ctx, dev.ID, month)
	require.NoError(t, err)
	assert.Empty(t, txs, "ntf mode should not record transaction")
}

func TestService_invalidComment_skip(t *testing.T) {
	svc, srv, dev := setupExpiryEnv(t, "rem")

	// User dengan comment bukan format expiry — harus di-skip.
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/print"),
		tcpmock.UserPrint("1", "alice", "default", "not-a-date"),
		tcpmock.DoneReply(),
	)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	require.NoError(t, svc.checkDevice(ctx, dev))

	srv.AssertNotReceived(t, tcpmock.MatchCommand("/ip/hotspot/user/remove"))
	srv.AssertNotReceived(t, tcpmock.MatchCommand("/ip/hotspot/user/set"))
}

func TestService_validComment_futureExpiry_skip(t *testing.T) {
	svc, srv, dev := setupExpiryEnv(t, "rem")

	future := time.Now().Add(72 * time.Hour)
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/print"),
		tcpmock.UserPrintExpired("1", "alice", "default", future),
		tcpmock.DoneReply(),
	)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	require.NoError(t, svc.checkDevice(ctx, dev))

	srv.AssertNotReceived(t, tcpmock.MatchCommand("/ip/hotspot/user/remove"))
}

// TestService_profileNotConfigured_skip memverifikasi bahwa kalau profile_config
// belum ada di DB (operator belum setup), expiry service SKIP tindakan apapun.
// Ini mencegah penghapusan user secara default agresif (bug lama pakai Get→"rem").
func TestService_profileNotConfigured_skip(t *testing.T) {
	svc, srv, dev := setupExpiryEnv(t, "rem") // profile "default" di-seed dengan mode "rem"

	past := time.Now().Add(-48 * time.Hour)
	// User dengan profile "unconfigured" — tidak ada config di DB untuk profile ini
	srv.OnSentence(tcpmock.MatchCommand("/ip/hotspot/user/print"),
		tcpmock.UserPrintExpired("1", "alice", "unconfigured", past),
		tcpmock.DoneReply(),
	)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	require.NoError(t, svc.checkDevice(ctx, dev))

	// Tidak ada remove karena profile "unconfigured" tidak ada di DB → skip
	srv.AssertNotReceived(t, tcpmock.MatchCommand("/ip/hotspot/user/remove"))
	srv.AssertNotReceived(t, tcpmock.MatchCommand("/ip/hotspot/user/set"))
}

func TestService_backoff_deviceNotConnected_returnsErr(t *testing.T) {
	// Manager tanpa device terdaftar → Get return ErrDeviceNotConnected.
	devStore, profStore, txStore := testutil.NewStores(t)
	log := logrus.New()
	log.SetLevel(logrus.WarnLevel)

	// New manager, no device registered.
	emptyMgr := devmgr.New(devStore, log)
	svc := New(emptyMgr, devStore, profStore, txStore, log)
	svc.rootCtx = context.Background()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	err := svc.checkDevice(ctx, model.MikrotikDevice{ID: 99})

	// runChecker akan switch ke backoff atas error ini; di sini kita verifikasi
	// surface ErrDeviceNotConnected langsung dari checkDevice.
	require.Error(t, err)
	assert.Contains(t, err.Error(), "not connected")
}

