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

// fakeTemplateStore — in-memory store.TemplateStore untuk handler test.
type fakeTemplateStore struct {
	mu   sync.Mutex
	rows map[string]model.MessageTemplate
}

func newFakeTemplateStore() *fakeTemplateStore {
	return &fakeTemplateStore{rows: map[string]model.MessageTemplate{}}
}

func (f *fakeTemplateStore) GetBySlug(_ context.Context, slug string) (model.MessageTemplate, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	t, ok := f.rows[slug]
	if !ok {
		return t, store.ErrTemplateNotFound
	}
	return t, nil
}

func (f *fakeTemplateStore) List(_ context.Context) ([]model.MessageTemplate, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]model.MessageTemplate, 0, len(f.rows))
	for _, t := range f.rows {
		out = append(out, t)
	}
	return out, nil
}

func (f *fakeTemplateStore) Update(_ context.Context, t *model.MessageTemplate) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.rows[t.Slug]; !ok {
		return store.ErrTemplateNotFound
	}
	f.rows[t.Slug] = *t
	return nil
}

var _ store.TemplateStore = (*fakeTemplateStore)(nil)

func setupTemplateEngine(t *testing.T) (*gin.Engine, *fakeTemplateStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	s := newFakeTemplateStore()
	g := r.Group("/api/v1")
	handler.NewMessageTemplates(s).Register(g)
	return r, s
}

func seedTemplate(s *fakeTemplateStore, slug string) {
	s.rows[slug] = model.MessageTemplate{ID: 1, Slug: slug, Name: "X", Body: "Halo {{.customer_name}}", Active: true}
}

func TestMessageTemplates_Get_OK(t *testing.T) {
	r, s := setupTemplateEngine(t)
	seedTemplate(s, "invoice_issued")
	w := doJSON(r, http.MethodGet, "/api/v1/message-templates/invoice_issued", nil)
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"slug":"invoice_issued"`)
}

func TestMessageTemplates_Get_NotFound(t *testing.T) {
	r, _ := setupTemplateEngine(t)
	w := doJSON(r, http.MethodGet, "/api/v1/message-templates/missing", nil)
	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.Contains(t, w.Body.String(), "NOT_FOUND")
}

func TestMessageTemplates_Update_PartialFields(t *testing.T) {
	r, s := setupTemplateEngine(t)
	seedTemplate(s, "invoice_issued")

	w := doJSON(r, http.MethodPut, "/api/v1/message-templates/invoice_issued", map[string]any{
		"body": "Tagihan baru {{.invoice_number}}",
	})
	require.Equal(t, http.StatusOK, w.Code, "body: %s", w.Body.String())

	got, _ := s.GetBySlug(context.Background(), "invoice_issued")
	assert.Equal(t, "Tagihan baru {{.invoice_number}}", got.Body)
	assert.Equal(t, "X", got.Name, "name tidak boleh ke-overwrite kosong")
}

func TestMessageTemplates_Update_NotFound(t *testing.T) {
	r, _ := setupTemplateEngine(t)
	w := doJSON(r, http.MethodPut, "/api/v1/message-templates/missing", map[string]any{"body": "x"})
	assert.Equal(t, http.StatusNotFound, w.Code)
}

func TestMessageTemplates_List(t *testing.T) {
	r, s := setupTemplateEngine(t)
	seedTemplate(s, "invoice_issued")
	w := doJSON(r, http.MethodGet, "/api/v1/message-templates", nil)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"count":1`)
}
