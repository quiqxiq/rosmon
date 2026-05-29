package testutil

import (
	"context"
	"testing"
	"time"

	"github.com/quiqxiq/roslib"
	"github.com/quiqxiq/rosmon/internal/tcpmock"
	"github.com/quiqxiq/rosmon/mikrotik/hotspot"
	"github.com/quiqxiq/rosmon/mikrotik/network"
	"github.com/quiqxiq/rosmon/mikrotik/ppp"
	"github.com/quiqxiq/rosmon/mikrotik/syslog"
	"github.com/quiqxiq/rosmon/mikrotik/system"
	"github.com/quiqxiq/rosmon/service/devmgr"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/quiqxiq/rosmon/workflows"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/require"
)

// MockDeviceID adalah ID konsisten untuk device dummy yang dipakai
// di test wiring. Tests yang butuh akses lewat devmgr.Manager.Get
// memakai ID ini.
const MockDeviceID = 1

// NewMockDevice start tcpmock server (sudah accept-login) lalu dial
// *roslib.Device ke alamatnya. Cleanup dev+srv otomatis via t.Cleanup.
//
// Pakai ini untuk test sub-paket mikrotik/ (hotspot, system, dll) yang
// hanya butuh device tanpa Manager.
func NewMockDevice(t *testing.T) (*roslib.Device, *tcpmock.Server) {
	t.Helper()

	srv, err := tcpmock.Start()
	require.NoError(t, err)
	srv.AcceptLogin()

	log := logrus.New()
	log.SetLevel(logrus.WarnLevel)

	// Pakai context yang umur-nya = test, supaya supervisor roslib tetap
	// hidup setelah NewMockDevice return.
	ctx, cancel := context.WithCancel(context.Background())

	dev, err := roslib.New(ctx, roslib.Options{
		Address:     srv.Addr(),
		Username:    "test",
		Password:    "test",
		Logger:      log,
		DialTimeout: 2 * time.Second,
	})
	require.NoError(t, err)

	// Cleanup LIFO order: pertama tutup dev (CloseAndWait menunggu supervisor
	// roslib benar-benar exit supaya reader tidak race dengan close socket),
	// lalu cancel ctx, lalu tutup mock server. Urutan ini menghindari race
	// di proto/io_context.go go-routeros yang terjadi saat conn putus
	// sebelum reader berhenti.
	t.Cleanup(func() { _ = srv.Close() })
	t.Cleanup(cancel)
	t.Cleanup(func() { _ = dev.CloseAndWait() })

	return dev, srv
}

// NewTestClientSet wrap NewMockDevice + bangun *devmgr.ClientSet siap pakai
// dengan semua sub-client (Hot, Sys, Net, PPP, Log, WF) terikat ke device
// mock. DeviceID di-set 1 (dummy).
func NewTestClientSet(t *testing.T) (*devmgr.ClientSet, *tcpmock.Server) {
	t.Helper()
	dev, srv := NewMockDevice(t)
	cs := &devmgr.ClientSet{
		DeviceID: 1,
		Dev:      dev,
		Hot:      hotspot.New(dev),
		Sys:      system.New(dev),
		Net:      network.New(dev),
		PPP:      ppp.New(dev),
		Log:      syslog.New(dev),
		WF:       workflows.New(dev),
	}
	return cs, srv
}

// NewTestDevMgr menyiapkan *devmgr.Manager dengan satu device dummy
// (ID=MockDeviceID) terdaftar via RegisterForTest dan terhubung
// ke tcpmock server. Mengembalikan manager, mock server, dan model device
// dummy yang siap dipakai untuk seed DB pada test expiry service.
func NewTestDevMgr(t *testing.T) (*devmgr.Manager, *tcpmock.Server, model.MikrotikDevice) {
	t.Helper()
	log := logrus.New()
	log.SetLevel(logrus.WarnLevel)

	cs, srv := NewTestClientSet(t)

	mgr := devmgr.New(nil, log)
	mgr.RegisterForTest(MockDeviceID, cs)

	dev := model.MikrotikDevice{
		ID:                  MockDeviceID,
		DisplayName:         "mock-device",
		Address:             srv.Addr(),
		Username:            "test",
		Password:            "test",
		Active:              true,
		ExpiryCheckInterval: "100ms",
	}
	return mgr, srv, dev
}
