package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/mikrotik/hotspot"
	"github.com/quiqxiq/rosmon/workflows"
)

type HotspotBinding struct {
	Hot *hotspot.Client
	WF  *workflows.Clients
}

func NewHotspotBinding(hot *hotspot.Client, wf *workflows.Clients) *HotspotBinding {
	return &HotspotBinding{Hot: hot, WF: wf}
}

func (h *HotspotBinding) Register(g *gin.RouterGroup) {
	h.RegisterSplit(g, g)
}

func (h *HotspotBinding) RegisterSplit(readGroup, writeGroup *gin.RouterGroup) {
	mk := func(c *gin.Context) *HotspotBinding {
		cs := mustClients(c)
		return NewHotspotBinding(cs.Hot, cs.WF)
	}
	r := readGroup.Group("/hotspot/bindings")
	r.GET("", func(c *gin.Context) { mk(c).List(c) })
	r.GET("/count", func(c *gin.Context) { mk(c).Count(c) })
	r.GET("/:id", func(c *gin.Context) { mk(c).Get(c) })

	w := writeGroup.Group("/hotspot/bindings")
	w.PATCH("/:id/type", func(c *gin.Context) { mk(c).SetType(c) })
	w.PATCH("/:id/disabled", func(c *gin.Context) { mk(c).SetDisabled(c) })
	w.DELETE("/:id", func(c *gin.Context) { mk(c).Delete(c) })
}

func (h *HotspotBinding) List(c *gin.Context) {
	bs, err := h.Hot.BindingList(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := dto.FromDomainBindings(bs)
	WriteList(c, out, len(out))
}

func (h *HotspotBinding) Count(c *gin.Context) {
	n, err := h.Hot.BindingCount(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.CountResponse{Count: n})
}

func (h *HotspotBinding) Get(c *gin.Context) {
	b, err := h.Hot.BindingByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromDomainBinding(b))
}

func (h *HotspotBinding) SetType(c *gin.Context) {
	var req dto.SetBindingTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if err := h.Hot.BindingSetType(c.Request.Context(), c.Param("id"), hotspot.BindingType(req.Type)); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func (h *HotspotBinding) SetDisabled(c *gin.Context) {
	var req dto.SetBoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if err := h.Hot.BindingSetDisabled(c.Request.Context(), c.Param("id"), req.Value); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func (h *HotspotBinding) Delete(c *gin.Context) {
	if err := workflows.DeleteBinding(c.Request.Context(), h.WF, c.Param("id")); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}
