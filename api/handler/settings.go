package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/store"
)

// Settings handler — GET /settings, PUT /settings/:key.
type Settings struct {
	Store store.SettingStore
}

func NewSettings(s store.SettingStore) *Settings {
	return &Settings{Store: s}
}

func (h *Settings) Register(g *gin.RouterGroup) {
	r := g.Group("/settings")
	r.GET("", h.List)
	r.PUT("/:key", h.Update)
}

func (h *Settings) List(c *gin.Context) {
	items, err := h.Store.List(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	type settingItem struct {
		Key         string `json:"key"`
		Value       string `json:"value"`
		ValueType   string `json:"value_type"`
		Description string `json:"description,omitempty"`
		GroupName   string `json:"group_name,omitempty"`
	}
	out := make([]settingItem, len(items))
	for i, s := range items {
		out[i] = settingItem{
			Key:         s.Key,
			Value:       s.Value,
			ValueType:   s.ValueType,
			Description: s.Description,
			GroupName:   s.GroupName,
		}
	}
	WriteList(c, out, len(out))
}

func (h *Settings) Update(c *gin.Context) {
	key := c.Param("key")
	var req struct {
		Value string `json:"value" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if err := h.Store.Set(c.Request.Context(), key, req.Value); err != nil {
		if errors.Is(err, store.ErrSettingNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "setting key not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	val, _ := h.Store.Get(c.Request.Context(), key)
	WriteOK(c, gin.H{"key": key, "value": val})
}
