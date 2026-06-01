package onlogin

import (
	"flag"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/quiqxiq/rosmon/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var update = flag.Bool("update", false, "regenerate golden files")

func TestBuild_GoldenFiles(t *testing.T) {
	const webhookURL = "http://192.168.1.10:8080/api/v1/hook/hotspot/login/1"
	cases := []struct {
		name string
		opts Options
	}{
		{
			name: "mode_none",
			opts: Options{Mode: domain.ModeNone, Price: 5000},
		},
		{
			name: "mode_remove",
			opts: Options{Mode: domain.ModeRemove, Validity: "1d", Price: 5000, SellPrice: 4500},
		},
		{
			name: "mode_notice",
			opts: Options{Mode: domain.ModeNotice, Validity: "30d", Price: 25000, SellPrice: 20000},
		},
		{
			name: "mode_remove_record",
			opts: Options{Mode: domain.ModeRemoveRecord, Validity: "1d", Price: 5000, SellPrice: 4500},
		},
		{
			name: "mode_notice_record_lock",
			opts: Options{Mode: domain.ModeNoticeRecord, Validity: "30d", Price: 25000, SellPrice: 20000, LockMAC: true},
		},
		{
			name: "mode_remove_lock_only",
			opts: Options{Mode: domain.ModeRemove, Validity: "1d", Price: 5000, SellPrice: 4500, LockMAC: true},
		},
		{
			name: "mode_remove_with_webhook",
			opts: Options{Mode: domain.ModeRemove, Validity: "1d", Price: 5000, SellPrice: 4500, WebhookURL: webhookURL, ProfileName: "1day"},
		},
		{
			name: "mode_remove_record_with_webhook",
			opts: Options{Mode: domain.ModeRemoveRecord, Validity: "1d", Price: 5000, SellPrice: 4500, WebhookURL: webhookURL, ProfileName: "1day"},
		},
		{
			name: "mode_notice_record_lock_with_webhook",
			opts: Options{Mode: domain.ModeNoticeRecord, Validity: "30d", Price: 25000, SellPrice: 20000, LockMAC: true, WebhookURL: webhookURL, ProfileName: "30day"},
		},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			got := Build(tt.opts)
			path := filepath.Join("testdata", "golden", tt.name+".txt")
			if *update {
				require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o755))
				require.NoError(t, os.WriteFile(path, []byte(got), 0o644))
				return
			}
			want, err := os.ReadFile(path)
			require.NoError(t, err, "missing golden file (run with -update)")
			assert.Equal(t, strings.ReplaceAll(string(want), "\r\n", "\n"), strings.ReplaceAll(got, "\r\n", "\n"))
		})
	}
}

// TestBuild_ModeNone_NoWebhook memastikan webhook block TIDAK ditambahkan
// untuk mode "0" (free profile) walau WebhookURL di-set — karena free
// profile tidak ada selling record yang perlu di-trigger.
func TestBuild_ModeNone_NoWebhook(t *testing.T) {
	got := Build(Options{
		Mode:       domain.ModeNone,
		Price:      0,
		WebhookURL: "http://example.com/hook",
	})
	assert.NotContains(t, got, "/tool fetch", "mode=0 should not emit webhook block")
}
