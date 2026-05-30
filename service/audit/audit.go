// Package audit menyediakan helper untuk menulis audit_logs secara non-fatal.
// Aturan AGENTS.md: setiap aksi yang mengubah status entitas utama
// (subscription/invoice/payment) wajib dicatat. Kegagalan menulis audit
// TIDAK boleh menggagalkan operasi bisnis — hanya di-log sebagai warning.
package audit

import (
	"context"
	"encoding/json"

	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
)

// Log menulis satu entry audit. userID nil = aksi sistem (cron/webhook).
// entityID 0 dianggap "tidak ada". oldVal/newVal di-marshal ke JSON; nil =
// kolom dibiarkan kosong. Aman dipanggil dengan store nil (no-op).
func Log(
	ctx context.Context,
	s store.AuditLogStore,
	log *logrus.Logger,
	userID *uint,
	action, entityType string,
	entityID uint,
	oldVal, newVal any,
) {
	if s == nil {
		return
	}
	entry := &model.AuditLog{
		UserID:     userID,
		Action:     action,
		EntityType: entityType,
	}
	if entityID != 0 {
		eid := entityID
		entry.EntityID = &eid
	}
	if oldVal != nil {
		if b, err := json.Marshal(oldVal); err == nil {
			entry.OldValues = string(b)
		}
	}
	if newVal != nil {
		if b, err := json.Marshal(newVal); err == nil {
			entry.NewValues = string(b)
		}
	}
	if err := s.Create(ctx, entry); err != nil && log != nil {
		log.WithError(err).WithFields(logrus.Fields{
			"action":      action,
			"entity_type": entityType,
			"entity_id":   entityID,
		}).Warn("audit: failed to write audit log")
	}
}
