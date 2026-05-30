package audit_test

import (
	"context"
	"errors"
	"testing"

	"github.com/quiqxiq/rosmon/service/audit"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type recordingAuditStore struct {
	entries []model.AuditLog
	err     error
}

func (s *recordingAuditStore) Create(_ context.Context, e *model.AuditLog) error {
	if s.err != nil {
		return s.err
	}
	s.entries = append(s.entries, *e)
	return nil
}

func (s *recordingAuditStore) List(_ context.Context, _ store.AuditLogFilter) ([]model.AuditLog, error) {
	return s.entries, nil
}

var _ store.AuditLogStore = (*recordingAuditStore)(nil)

func TestLog_RecordsEntryWithJSON(t *testing.T) {
	s := &recordingAuditStore{}
	uid := uint(7)
	type snap struct {
		Status string `json:"status"`
	}
	audit.Log(context.Background(), s, logrus.New(), &uid, "isolir", "Subscription", 42,
		snap{"active"}, snap{"isolir"})

	require.Len(t, s.entries, 1)
	e := s.entries[0]
	assert.Equal(t, "isolir", e.Action)
	assert.Equal(t, "Subscription", e.EntityType)
	require.NotNil(t, e.EntityID)
	assert.Equal(t, uint(42), *e.EntityID)
	require.NotNil(t, e.UserID)
	assert.Equal(t, uint(7), *e.UserID)
	assert.JSONEq(t, `{"status":"active"}`, e.OldValues)
	assert.JSONEq(t, `{"status":"isolir"}`, e.NewValues)
}

func TestLog_NilStore_NoPanic(t *testing.T) {
	assert.NotPanics(t, func() {
		audit.Log(context.Background(), nil, logrus.New(), nil, "x", "Y", 0, nil, nil)
	})
}

func TestLog_StoreError_NonFatal(t *testing.T) {
	s := &recordingAuditStore{err: errors.New("db down")}
	assert.NotPanics(t, func() {
		audit.Log(context.Background(), s, logrus.New(), nil, "noop", "Y", 1, nil, nil)
	})
	assert.Empty(t, s.entries)
}
