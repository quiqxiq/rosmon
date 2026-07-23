package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/mikrotik/ppp"
)

type PPPActive struct{ PPP *ppp.Client }

func NewPPPActive(pp *ppp.Client) *PPPActive { return &PPPActive{PPP: pp} }

func (h *PPPActive) Register(g *gin.RouterGroup) {
	h.RegisterSplit(g, g)
}

func (h *PPPActive) RegisterSplit(readGroup, writeGroup *gin.RouterGroup) {
	mk := func(c *gin.Context) *PPPActive { return NewPPPActive(mustClients(c).PPP) }
	r := readGroup.Group("/ppp/active")
	r.GET("", func(c *gin.Context) { mk(c).List(c) })

	w := writeGroup.Group("/ppp/active")
	w.DELETE("/:id", func(c *gin.Context) { mk(c).Delete(c) })
}

func (h *PPPActive) List(c *gin.Context) {
	as, err := h.PPP.ActiveList(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := dto.FromDomainPPPActives(as)
	WriteList(c, out, len(out))
}

func (h *PPPActive) Delete(c *gin.Context) {
	if err := h.PPP.ActiveRemove(c.Request.Context(), c.Param("id")); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}
