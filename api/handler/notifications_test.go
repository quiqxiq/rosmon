package handler_test

import (
	"context"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeNotifLogStore — in-memory store.NotificationLogStore untuk handler test.
type fakeNotifLogStore struct {
	mu   sync.Mutex
	rows []model.NotificationLog
}

func newFakeNotifLogStore() *fakeNotifLogStore { return &fakeNotifLogStore{} }

func (f *fakeNotifLogStore) Create(_ context.Context, l *model.NotificationLog) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if l.Status == "" {
		l.Status = "pending"
	}
	l.ID = uint(len(f.rows) + 1)
	f.rows = append(f.rows, *l)
	return nil
}

func (f *fakeNotifLogStore) MarkSent(_ context.Context, id uint, _ string, _ time.Time) error {
	return nil
}
func (f *fakeNotifLogStore) MarkFailed(_ context.Context, id uint, _ string, _ time.Time) error {
	return nil
}
func (f *fakeNotifLogStore) ListPendingRetry(_ context.Context, _ time.Time, _ int) ([]model.NotificationLog, error) {
	return nil, nil
}

func (f *fakeNotifLogStore) List(_ context.Context, fil store.NotificationLogFilter) ([]model.NotificationLog, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]model.NotificationLog, 0, len(f.rows))
	for _, l := range f.rows {
		if fil.Status != "" && l.Status != fil.Status {
			continue
		}
		out = append(out, l)
	}
	return out, nil
}

var _ store.NotificationLogStore = (*fakeNotifLogStore)(nil)

func setupNotifEngine(t *testing.T) (*gin.Engine, *fakeNotifLogStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	s := newFakeNotifLogStore()
	g := r.Group("/api/v1")
	handler.NewNotifications(s).Register(g)
	return r, s
}

func TestNotifications_List_FilterByStatus(t *testing.T) {
	r, s := setupNotifEngine(t)
	_ = s.Create(context.Background(), &model.NotificationLog{TemplateSlug: "invoice_issued", RecipientPhone: "0811", MessageBody: "x", Status: "sent"})
	_ = s.Create(context.Background(), &model.NotificationLog{TemplateSlug: "invoice_issued", RecipientPhone: "0822", MessageBody: "y", Status: "failed"})

	w := doJSON(r, http.MethodGet, "/api/v1/notifications?status=failed", nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"count":1`)
	assert.Contains(t, w.Body.String(), `"status":"failed"`)
}
