package devmgr

import (
	"crypto/tls"
	"errors"
	"testing"

	"github.com/sirupsen/logrus"
)

func TestGet_returnsSentinelWhenSlugMissing(t *testing.T) {
	m := New(nil, logrus.New())
	_, err := m.Get("unknown-slug")
	if !errors.Is(err, ErrDeviceNotConnected) {
		t.Fatalf("Get(missing) err = %v, want ErrDeviceNotConnected", err)
	}
}

func TestListActive_emptyByDefault(t *testing.T) {
	m := New(nil, logrus.New())
	if got := m.ListActive(); len(got) != 0 {
		t.Fatalf("ListActive() = %v, want empty", got)
	}
}

func TestListActive_returnsCopy(t *testing.T) {
	// Pastikan ListActive return snapshot copy, bukan reference ke internal map.
	// Mutasi pada return value tidak boleh mengubah state internal manager.
	m := New(nil, logrus.New())
	m.active["fake"] = &ClientSet{DeviceID: 1}
	got := m.ListActive()
	if len(got) != 1 {
		t.Fatalf("ListActive() len = %d, want 1", len(got))
	}
	delete(got, "fake")
	if _, ok := m.active["fake"]; !ok {
		t.Errorf("ListActive() returned reference, not copy")
	}
}

func TestBuildTLSConfig(t *testing.T) {
	cases := []struct {
		name           string
		address        string
		wantServerName string
	}{
		{"host:port standard", "192.168.88.1:8729", "192.168.88.1"},
		{"hostname:port", "router.local:8729", "router.local"},
		{"no port", "192.168.88.1", "192.168.88.1"},
		{"ipv6 with port", "[fe80::1]:8729", "fe80::1"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := buildTLSConfig(tc.address)
			if cfg == nil {
				t.Fatal("buildTLSConfig returned nil")
			}
			if cfg.ServerName != tc.wantServerName {
				t.Errorf("ServerName = %q, want %q", cfg.ServerName, tc.wantServerName)
			}
			if cfg.MinVersion != tls.VersionTLS12 {
				t.Errorf("MinVersion = %d, want %d", cfg.MinVersion, tls.VersionTLS12)
			}
		})
	}
}

func TestBuildTLSConfig_insecureSkipVerify_optIn(t *testing.T) {
	// Default tanpa env var: InsecureSkipVerify=false (strict).
	t.Setenv("DEVICE_TLS_INSECURE", "")
	cfg := buildTLSConfig("router.local:8729")
	if cfg.InsecureSkipVerify {
		t.Error("default InsecureSkipVerify should be false")
	}

	// Dengan env var = "true": InsecureSkipVerify=true (opt-in).
	t.Setenv("DEVICE_TLS_INSECURE", "true")
	cfg = buildTLSConfig("router.local:8729")
	if !cfg.InsecureSkipVerify {
		t.Error("DEVICE_TLS_INSECURE=true should enable InsecureSkipVerify")
	}

	// Nilai lain dari env: tetap false (strict).
	t.Setenv("DEVICE_TLS_INSECURE", "yes")
	cfg = buildTLSConfig("router.local:8729")
	if cfg.InsecureSkipVerify {
		t.Error("DEVICE_TLS_INSECURE=yes (non-'true') should keep InsecureSkipVerify=false")
	}
}

func TestRemove_noopWhenSlugMissing(t *testing.T) {
	// Remove ke slug yang tidak ada harus aman (no panic, no callback fired).
	called := false
	m := New(nil, logrus.New())
	m.OnDeviceRemoved = func(string) { called = true }
	m.Remove("nonexistent")
	if called {
		t.Error("OnDeviceRemoved should not fire for missing slug")
	}
}
