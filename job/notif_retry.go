package job

import (
	"context"
	"time"

	"github.com/quiqxiq/rosmon/service/notification"
	"github.com/sirupsen/logrus"
)

const (
	notifRetryBatch    = 50
	notifRetryInterval = 5 * time.Minute
)

// NotifRetryJob mengirim ulang notifikasi yang gagal (status=failed) yang
// sudah waktunya retry. Idempotent — aman dijalankan ulang. Logika ada di
// notification.Service.RetryPending.
type NotifRetryJob struct {
	Notification *notification.Service
	Log          *logrus.Logger
}

func NewNotifRetryJob(svc *notification.Service, log *logrus.Logger) *NotifRetryJob {
	if log == nil {
		log = logrus.New()
	}
	return &NotifRetryJob{Notification: svc, Log: log}
}

func (j *NotifRetryJob) Run(ctx context.Context) error {
	if j.Notification == nil {
		return nil
	}
	n, err := j.Notification.RetryPending(ctx, notifRetryBatch)
	if err != nil {
		return err
	}
	if n > 0 {
		j.Log.WithField("resent", n).Info("notif_retry: done")
	}
	return nil
}

// Start menjalankan Run tiap notifRetryInterval di goroutine background.
func (j *NotifRetryJob) Start(ctx context.Context) {
	go func() {
		ticker := time.NewTicker(notifRetryInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := j.Run(ctx); err != nil {
					j.Log.WithError(err).Warn("notif_retry: run error")
				}
			}
		}
	}()
}
