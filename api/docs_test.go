package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/docs"
)

func TestRegisterDocs_servesBundledSpec(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	RegisterDocs(r)

	t.Run("openapi.yaml returns embedded bundle", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/docs/openapi.yaml", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", w.Code)
		}
		if ct := w.Header().Get("Content-Type"); !strings.HasPrefix(ct, "application/yaml") {
			t.Errorf("Content-Type = %q, want application/yaml*", ct)
		}
		body := w.Body.Bytes()
		if !bytes.Equal(body, docs.OpenAPIBundle) {
			t.Errorf("body != embedded bundle (len %d vs %d)", len(body), len(docs.OpenAPIBundle))
		}
		if !bytes.HasPrefix(body, []byte("openapi: 3.0.3")) {
			head := body
			if len(head) > 40 {
				head = head[:40]
			}
			t.Errorf("bundle missing openapi header, got: %q", head)
		}
	})

	t.Run("bundle has no external file refs", func(t *testing.T) {
		// Setiap $ref di bundle harus internal (#/components/...).
		// Kalau ada "./" atau "../" berarti bundling gagal.
		if bytes.Contains(docs.OpenAPIBundle, []byte("$ref: './")) ||
			bytes.Contains(docs.OpenAPIBundle, []byte("$ref: '../")) ||
			bytes.Contains(docs.OpenAPIBundle, []byte("$ref: \"./")) ||
			bytes.Contains(docs.OpenAPIBundle, []byte("$ref: \"../")) {
			t.Error("bundle contains external $ref — regen via 'make openapi-bundle'")
		}
	})

	t.Run("docs UI returns embedded HTML with correct data-url", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/docs", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("status = %d, want 200", w.Code)
		}
		body := w.Body.String()
		if !strings.Contains(body, `data-url="/docs/openapi.yaml"`) {
			t.Error("scalar HTML missing expected data-url=/docs/openapi.yaml")
		}
		if !strings.Contains(body, "@scalar/api-reference") {
			t.Error("scalar HTML missing @scalar/api-reference script")
		}
	})
}

