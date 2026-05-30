package job

import (
	"context"
	"strconv"

	"github.com/quiqxiq/rosmon/service/notification"
	"github.com/quiqxiq/rosmon/store"
)

// notifyCustomer mengirim notifikasi ke seorang pelanggan lewat
// service/notification. Mengisi otomatis var customer_name & company_name,
// lalu menggabungkan extra. Best-effort & nil-safe — tidak boleh menggagalkan
// job. NotifyAsync sudah menulis notification_log.
func notifyCustomer(
	ctx context.Context,
	notif *notification.Service,
	custStore store.CustomerStore,
	settings store.SettingStore,
	customerID uint,
	slug string,
	extra map[string]string,
) {
	if notif == nil || custStore == nil {
		return
	}
	cust, err := custStore.Get(ctx, customerID)
	if err != nil || cust.Phone == "" {
		return
	}
	vars := map[string]string{
		"customer_name": cust.FullName,
		"company_name":  settingString(ctx, settings, "general.company_name", ""),
	}
	for k, v := range extra {
		vars[k] = v
	}
	cid := cust.ID
	notif.NotifyAsync(&cid, cust.Phone, slug, vars)
}

// settingString membaca setting string dengan fallback default.
func settingString(ctx context.Context, settings store.SettingStore, key, def string) string {
	if settings == nil {
		return def
	}
	v, err := settings.Get(ctx, key)
	if err != nil || v == "" {
		return def
	}
	return v
}

// formatRupiah memformat angka jadi format ribuan dengan pemisah titik
// (mis. 250000 → "250.000"). Tanpa simbol "Rp" (template yang menambahkannya).
func formatRupiah(n int64) string {
	neg := n < 0
	if neg {
		n = -n
	}
	s := strconv.FormatInt(n, 10)
	var out []byte
	for i := 0; i < len(s); i++ {
		if i > 0 && (len(s)-i)%3 == 0 {
			out = append(out, '.')
		}
		out = append(out, s[i])
	}
	if neg {
		return "-" + string(out)
	}
	return string(out)
}
