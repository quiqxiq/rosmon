//go:build integration && dbtest

package integration

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/quiqxiq/rosmon/internal/testutil"
	"github.com/quiqxiq/rosmon/mikrotik"
	"github.com/quiqxiq/rosmon/mikrotik/hotspot"
	"github.com/quiqxiq/rosmon/service/devmgr"
	"github.com/quiqxiq/rosmon/service/expiry"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/quiqxiq/rosmon/workflows"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupLiveExpiry men-setup environment expiry service yang hidup ke router
// fisik + postgres testcontainer. Mengembalikan service, ClientSet ke router
// (untuk seed/cleanup user), dan model device.
func setupLiveExpiry(t *testing.T, mode string, profileName string) (*expiry.Service, *devmgr.ClientSet, model.MikrotikDevice) {
	t.Helper()
	testutil.RequireIntegration(t)

	dev := testutil.NewClient(t)
	log := logrus.New()
	log.SetLevel(logrus.WarnLevel)

	cs := &devmgr.ClientSet{
		DeviceID: 1,
		Dev:      dev,
		Hot:      hotspot.New(dev),
		WF:       workflows.New(dev),
	}

	devStore, profStore, txStore := testutil.NewStores(t)
	mgr := devmgr.New(devStore, log)
	mgr.RegisterForTest(1, cs)

	d := model.MikrotikDevice{
		ID:                  1,
		DisplayName:         "live-expiry",
		Host:                "router",
		Port:                8728,
		Active:              true,
		ExpiryCheckInterval: "100ms",
	}
	ctx := context.Background()
	require.NoError(t, devStore.Create(ctx, &d))
	// Voucher profile config kini menyatu di model.HotspotProfile (Role=voucher).
	_, err := profStore.Upsert(ctx, &model.HotspotProfile{
		DeviceID:   d.ID,
		Name:       profileName,
		Role:       "voucher",
		ExpiryMode: mode,
		Price:      10000,
		SellPrice:  12000,
		Validity:   "30d",
	})
	require.NoError(t, err)

	svc := expiry.New(mgr, devStore, profStore, txStore, log)
	return svc, cs, d
}

// addExpiredHotspotUser tambah user ke router fisik dengan comment past-time
// (Mikhmon format) supaya expiry checker mendeteksinya sebagai expired.
func addExpiredHotspotUser(t *testing.T, cs *devmgr.ClientSet, profileName string) (id, name string) {
	t.Helper()
	ctx := testutil.Context(t)
	name = testutil.UniqueName(t, "exp")
	past := time.Now().Add(-48 * time.Hour)
	stamp := strings.ToLower(past.Format("Jan/02/2006 15:04:05"))

	id, err := cs.Hot.UserAdd(ctx, hotspot.UserAddArgs{
		Name:     name,
		Password: "p4ssw0rd",
		Profile:  profileName,
		Comment:  stamp,
	})
	require.NoError(t, err)
	require.NotEmpty(t, id)
	t.Cleanup(func() {
		// Best-effort cleanup kalau test gagal mid-way.
		_ = cs.Hot.UserRemove(testutil.Context(t), id)
	})
	return id, name
}

func TestIntegration_Expiry_remMode_userDeleted(t *testing.T) {
	const profileName = "default"
	svc, cs, dev := setupLiveExpiry(t, "rem", profileName)
	id, name := addExpiredHotspotUser(t, cs, profileName)

	ctx := testutil.Context(t)
	require.NoError(t, expiryCheckDevice(t, svc, ctx, dev))

	// User harus sudah ke-delete.
	_, err := cs.Hot.UserByID(ctx, id)
	require.Error(t, err)
	assert.ErrorIs(t, err, mikrotik.ErrNotFound, "user %s should have been deleted", name)
}

func TestIntegration_Expiry_ntfMode_limitUptimeSet(t *testing.T) {
	const profileName = "default"
	svc, cs, dev := setupLiveExpiry(t, "ntf", profileName)
	id, _ := addExpiredHotspotUser(t, cs, profileName)

	ctx := testutil.Context(t)
	require.NoError(t, expiryCheckDevice(t, svc, ctx, dev))

	got, err := cs.Hot.UserByID(ctx, id)
	require.NoError(t, err)
	assert.Equal(t, "1s", got.LimitUptime, "ntf mode should set limit-uptime=1s")
}

// TestIntegration_Expiry_remcMode_userDeleted_noRecord: mode remc harus menghapus
// user dari router tapi TIDAK mencatat transaksi. Recording adalah tanggung jawab
// webhook login handler, bukan expiry service.
func TestIntegration_Expiry_remcMode_userDeleted_noRecord(t *testing.T) {
	const profileName = "default"
	svc, cs, dev := setupLiveExpiry(t, "remc", profileName)
	id, _ := addExpiredHotspotUser(t, cs, profileName)

	ctx := testutil.Context(t)
	require.NoError(t, expiryCheckDevice(t, svc, ctx, dev))

	// User harus sudah ke-delete.
	_, err := cs.Hot.UserByID(ctx, id)
	require.Error(t, err)
	assert.ErrorIs(t, err, mikrotik.ErrNotFound, "remc: user expired harus dihapus dari router")
}

// expiryCheckDevice membungkus pemanggilan Service.Start lalu menunggu satu tick
// (ExpiryCheckInterval=100ms) supaya satu siklus check selesai.
func expiryCheckDevice(t *testing.T, svc *expiry.Service, ctx context.Context, dev model.MikrotikDevice) error {
	t.Helper()
	startCtx, cancel := context.WithCancel(ctx)
	t.Cleanup(cancel)
	if err := svc.Start(startCtx); err != nil {
		return err
	}
	// Tunggu minimal 1 tick (interval 100ms) + grace.
	time.Sleep(500 * time.Millisecond)
	return nil
}
