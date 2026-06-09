// Package notification adalah satu-satunya jalur pengiriman notifikasi ke
// pelanggan (aturan AGENTS.md: tidak ada HTTP call langsung ke gateway WA
// dari handler/service lain). Service merender template, menulis
// notification_logs, dan mengirim lewat Sender.
package notification

import "context"

// Sender mengirim satu pesan teks ke nomor tujuan. Implementasi nyata:
// whatsapp.Manager (embedded whatsmeow). NoopSender dipakai di dev/test atau
// saat WhatsApp belum dikonfigurasi. providerResp = id pesan / respons mentah
// provider untuk disimpan di notification_logs.
type Sender interface {
	Send(ctx context.Context, phone, message string) (providerResp string, err error)
	// Name mengidentifikasi provider untuk logging (mis. "whatsmeow", "noop").
	Name() string
}
