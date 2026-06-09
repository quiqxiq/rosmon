package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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

// fakeCustomerStore — in-memory implementasi store.CustomerStore untuk
// handler test. Phone uniqueness di-enforce di Create/Update.
type fakeCustomerStore struct {
	mu   sync.Mutex
	rows map[uint]model.Customer
	seq  uint
}

func newFakeCustomerStore() *fakeCustomerStore {
	return &fakeCustomerStore{rows: map[uint]model.Customer{}}
}

func (f *fakeCustomerStore) List(ctx context.Context, fil store.CustomerListFilter) ([]model.Customer, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]model.Customer, 0, len(f.rows))
	for _, c := range f.rows {
		if fil.Status != "" && c.Status != fil.Status {
			continue
		}
		if fil.Area != "" && c.Area != fil.Area {
			continue
		}
		out = append(out, c)
	}
	return out, nil
}

func (f *fakeCustomerStore) Get(ctx context.Context, id uint) (model.Customer, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	c, ok := f.rows[id]
	if !ok {
		return c, store.ErrCustomerNotFound
	}
	return c, nil
}

func (f *fakeCustomerStore) GetByPhone(ctx context.Context, phone string) (model.Customer, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, c := range f.rows {
		if c.Phone == phone {
			return c, nil
		}
	}
	return model.Customer{}, store.ErrCustomerNotFound
}

func (f *fakeCustomerStore) Create(ctx context.Context, c *model.Customer) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, existing := range f.rows {
		if existing.Phone == c.Phone {
			return store.ErrCustomerPhoneTaken
		}
	}
	if c.Status == "" {
		c.Status = "aktif"
	}
	f.seq++
	c.ID = f.seq
	c.CreatedAt = time.Now()
	c.UpdatedAt = c.CreatedAt
	f.rows[c.ID] = *c
	return nil
}

func (f *fakeCustomerStore) Update(ctx context.Context, c *model.Customer) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, existing := range f.rows {
		if existing.ID != c.ID && existing.Phone == c.Phone {
			return store.ErrCustomerPhoneTaken
		}
	}
	if _, ok := f.rows[c.ID]; !ok {
		return store.ErrCustomerNotFound
	}
	c.UpdatedAt = time.Now()
	f.rows[c.ID] = *c
	return nil
}

func (f *fakeCustomerStore) Delete(ctx context.Context, id uint) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.rows[id]; !ok {
		return store.ErrCustomerNotFound
	}
	delete(f.rows, id)
	return nil
}

var _ store.CustomerStore = (*fakeCustomerStore)(nil)

func setupCustomerEngine(t *testing.T) (*gin.Engine, *fakeCustomerStore) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	s := newFakeCustomerStore()
	g := r.Group("/api/v1")
	h := handler.NewCustomers(s)
	h.Register(g)
	h.RegisterMutate(g)
	return r, s
}

func doJSON(r *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestCustomers_Create_OK(t *testing.T) {
	r, s := setupCustomerEngine(t)
	w := doJSON(r, http.MethodPost, "/api/v1/customers", map[string]any{
		"full_name": "Pak Budi",
		"phone":     "08111",
		"address":   "Jl. Mawar 1",
		"area":      "RT01",
	})
	require.Equal(t, http.StatusCreated, w.Code, "body: %s", w.Body.String())
	assert.Contains(t, w.Body.String(), `"full_name":"Pak Budi"`)
	assert.Contains(t, w.Body.String(), `"status":"aktif"`)

	list, _ := s.List(context.Background(), store.CustomerListFilter{})
	require.Len(t, list, 1)
	assert.Equal(t, "08111", list[0].Phone)
}

func TestCustomers_Create_DuplicatePhone_Returns409(t *testing.T) {
	r, _ := setupCustomerEngine(t)
	doJSON(r, http.MethodPost, "/api/v1/customers", map[string]any{
		"full_name": "Pak Budi", "phone": "08111", "address": "x",
	})
	w := doJSON(r, http.MethodPost, "/api/v1/customers", map[string]any{
		"full_name": "Pak Joko", "phone": "08111", "address": "y",
	})
	assert.Equal(t, http.StatusConflict, w.Code)
	assert.Contains(t, w.Body.String(), "CONFLICT")
}

func TestCustomers_Create_MissingRequired_Returns400(t *testing.T) {
	r, _ := setupCustomerEngine(t)
	w := doJSON(r, http.MethodPost, "/api/v1/customers", map[string]any{
		"phone": "08111", // full_name missing
	})
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "VALIDATION")
}

func TestCustomers_Get_NotFound(t *testing.T) {
	r, _ := setupCustomerEngine(t)
	w := doJSON(r, http.MethodGet, "/api/v1/customers/99", nil)
	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.Contains(t, w.Body.String(), "NOT_FOUND")
}

func TestCustomers_Get_InvalidID(t *testing.T) {
	r, _ := setupCustomerEngine(t)
	w := doJSON(r, http.MethodGet, "/api/v1/customers/abc", nil)
	assert.Equal(t, http.StatusBadRequest, w.Code)
	assert.Contains(t, w.Body.String(), "INVALID_ID")
}

func TestCustomers_Update_PartialFields(t *testing.T) {
	r, s := setupCustomerEngine(t)
	doJSON(r, http.MethodPost, "/api/v1/customers", map[string]any{
		"full_name": "Pak Budi", "phone": "08111", "address": "Jl. A",
	})

	newAddr := "Jl. B"
	w := doJSON(r, http.MethodPut, "/api/v1/customers/1", map[string]any{
		"address": newAddr,
	})
	require.Equal(t, http.StatusOK, w.Code)

	c, _ := s.Get(context.Background(), 1)
	assert.Equal(t, "Pak Budi", c.FullName, "FullName tidak boleh ke-overwrite kosong")
	assert.Equal(t, "Jl. B", c.Address)
	assert.Equal(t, "08111", c.Phone)
}

func TestCustomers_Update_DuplicatePhone_Returns409(t *testing.T) {
	r, _ := setupCustomerEngine(t)
	doJSON(r, http.MethodPost, "/api/v1/customers", map[string]any{"full_name": "A", "phone": "08111"})
	doJSON(r, http.MethodPost, "/api/v1/customers", map[string]any{"full_name": "B", "phone": "08222"})

	w := doJSON(r, http.MethodPut, "/api/v1/customers/2", map[string]any{"phone": "08111"})
	assert.Equal(t, http.StatusConflict, w.Code)
}

func TestCustomers_Delete(t *testing.T) {
	r, s := setupCustomerEngine(t)
	doJSON(r, http.MethodPost, "/api/v1/customers", map[string]any{"full_name": "A", "phone": "08111"})

	w := doJSON(r, http.MethodDelete, "/api/v1/customers/1", nil)
	require.Equal(t, http.StatusNoContent, w.Code)

	_, err := s.Get(context.Background(), 1)
	assert.ErrorIs(t, err, store.ErrCustomerNotFound)
}

func TestCustomers_List_WithFilter(t *testing.T) {
	r, _ := setupCustomerEngine(t)
	doJSON(r, http.MethodPost, "/api/v1/customers", map[string]any{"full_name": "A", "phone": "081", "area": "RT01"})
	doJSON(r, http.MethodPost, "/api/v1/customers", map[string]any{"full_name": "B", "phone": "082", "area": "RT02"})

	w := doJSON(r, http.MethodGet, "/api/v1/customers?area=RT01", nil)
	require.Equal(t, http.StatusOK, w.Code)
	// Decode dan cek count = 1
	var resp struct {
		Data []map[string]any `json:"data"`
		Meta map[string]any   `json:"meta"`
	}
	require.NoError(t, json.NewDecoder(w.Body).Decode(&resp))
	assert.Equal(t, float64(1), resp.Meta["count"])
}
