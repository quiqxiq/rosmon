package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/store"
)

// MessageTemplates handler untuk /message-templates (admin). Template di-seed
// saat migrate; admin hanya boleh edit (slug immutable, tidak ada create/delete).
type MessageTemplates struct {
	Store store.TemplateStore
}

func NewMessageTemplates(s store.TemplateStore) *MessageTemplates {
	return &MessageTemplates{Store: s}
}

func (h *MessageTemplates) Register(g *gin.RouterGroup) {
	r := g.Group("/message-templates")
	r.GET("", h.List)
	r.GET("/:slug", h.Get)
	r.PUT("/:slug", h.Update)
}

func (h *MessageTemplates) List(c *gin.Context) {
	items, err := h.Store.List(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.MessageTemplateResponse, len(items))
	for i, it := range items {
		out[i] = dto.FromModelMessageTemplate(it)
	}
	WriteList(c, out, len(out))
}

func (h *MessageTemplates) Get(c *gin.Context) {
	t, err := h.Store.GetBySlug(c.Request.Context(), c.Param("slug"))
	if err != nil {
		h.writeErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelMessageTemplate(t))
}

func (h *MessageTemplates) Update(c *gin.Context) {
	slug := c.Param("slug")
	var req dto.MessageTemplateUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	t, err := h.Store.GetBySlug(c.Request.Context(), slug)
	if err != nil {
		h.writeErr(c, err)
		return
	}
	if req.Name != nil {
		t.Name = *req.Name
	}
	if req.Body != nil {
		t.Body = *req.Body
	}
	if req.Variables != nil {
		t.Variables = *req.Variables
	}
	if req.Active != nil {
		t.Active = *req.Active
	}
	if err := h.Store.Update(c.Request.Context(), &t); err != nil {
		h.writeErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelMessageTemplate(t))
}

func (h *MessageTemplates) writeErr(c *gin.Context, err error) {
	if errors.Is(err, store.ErrTemplateNotFound) {
		c.AbortWithStatusJSON(http.StatusNotFound,
			dto.Err("NOT_FOUND", "message template not found", c.Request.URL.Path))
		return
	}
	WriteErr(c, err)
}
