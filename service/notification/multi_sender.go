package notification

import (
	"context"
	"fmt"
	"strings"
)

// MultiSender mengirim pesan ke semua sender secara berurutan.
// Gagal di satu sender tidak menghentikan pengiriman ke sender berikutnya.
// Error gabungan dikembalikan jika semua sender gagal.
type MultiSender struct {
	senders []Sender
}

// NewMultiSender membuat MultiSender dari satu atau lebih Sender.
// Nil entries di-skip.
func NewMultiSender(senders ...Sender) Sender {
	var active []Sender
	for _, s := range senders {
		if s != nil {
			active = append(active, s)
		}
	}
	switch len(active) {
	case 0:
		return NoopSender{}
	case 1:
		return active[0]
	default:
		return &MultiSender{senders: active}
	}
}

func (m *MultiSender) Name() string {
	names := make([]string, len(m.senders))
	for i, s := range m.senders {
		names[i] = s.Name()
	}
	return "multi[" + strings.Join(names, ",") + "]"
}

func (m *MultiSender) Send(ctx context.Context, phone, message string) (string, error) {
	var errs []string
	var responses []string
	for _, s := range m.senders {
		resp, err := s.Send(ctx, phone, message)
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", s.Name(), err))
		} else {
			responses = append(responses, resp)
		}
	}
	if len(errs) == len(m.senders) {
		return "", fmt.Errorf("all senders failed: %s", strings.Join(errs, "; "))
	}
	return strings.Join(responses, ";"), nil
}
