package handler_test

import (
	"context"
	"net/http"
	"sync"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/handler"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// fakeAuditLogStore — in-memory store.AuditLogStore untuk handler test.
type fakeAuditLogStore struct {
	mu   sync.Mutex
	rows []model.AuditLog
}

func newFakeAuditLogStore() *fakeAuditLogStore { return &fakeAuditLogStore{} }

func (f *fakeAuditLogStore) Create(_ context.Context, e *model.AuditLog) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	e.ID = uint(len(f.rows) + 1)
	f.rows = append(f.rows, *e)
	return nil
}

func (f *fakeAuditLogStore) List(_ context.Context, fil store.AuditLogFilter) ([]model.AuditLog, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]model.AuditLog, 0, len(f.rows))
	for _, e := range f.rows {
		if fil.EntityType != "" && e.EntityType != fil.EntityType {
			continue
		}
		if fil.Action != "" && e.Action != fil.Action {
			continue
		}
		out = append(out, e)
	}
	return out, nil
}

var _ store.AuditLogStore = (*fakeAuditLogStore)(nil)

func setupAuditEngine(t *testing.T) (*gin.Engine, *fakeAuditLogStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	s := newFakeAuditLogStore()
	g := r.Group("/api/v1")
	handler.NewAuditLogs(s).Register(g)
	return r, s
}

func TestAuditLogs_List_FilterByEntityType(t *testing.T) {
	r, s := setupAuditEngine(t)
	_ = s.Create(context.Background(), &model.AuditLog{Action: "isolir", EntityType: "Subscription"})
	_ = s.Create(context.Background(), &model.AuditLog{Action: "confirm", EntityType: "Payment"})

	w := doJSON(r, http.MethodGet, "/api/v1/audit-logs?entity_type=Subscription", nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"count":1`)
	assert.Contains(t, w.Body.String(), `"entity_type":"Subscription"`)
}
