package notification

import "context"

// NoopSender tidak mengirim apa pun. Dipakai saat WhatsApp belum dikonfigurasi
// atau di test. Catatan: Service.Notify hanya memanggil Sender ketika
// notification.wa_enabled=true, jadi pada operasi normal NoopSender praktis
// tidak terpanggil; di test ia mensimulasikan pengiriman sukses.
type NoopSender struct{}

func (NoopSender) Send(_ context.Context, _, _ string) (string, error) { return "noop", nil }
func (NoopSender) Name() string                                        { return "noop" }
