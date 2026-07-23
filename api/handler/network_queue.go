package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/domain"
	"github.com/quiqxiq/rosmon/mikrotik/network"
)

type NetworkQueue struct{ Net *network.Client }

func NewNetworkQueue(net *network.Client) *NetworkQueue { return &NetworkQueue{Net: net} }

func (h *NetworkQueue) Register(g *gin.RouterGroup) {
	h.RegisterSplit(g, g)
}

func (h *NetworkQueue) RegisterSplit(readGroup, writeGroup *gin.RouterGroup) {
	mk := func(c *gin.Context) *NetworkQueue { return NewNetworkQueue(mustClients(c).Net) }
	r := readGroup.Group("/network/queues")
	r.GET("", func(c *gin.Context) { mk(c).List(c) })

	w := writeGroup.Group("/network/queues")
	w.DELETE("/:id", func(c *gin.Context) { mk(c).Delete(c) })
}

func (h *NetworkQueue) List(c *gin.Context) {
	ctx := c.Request.Context()
	var qs []domain.QueueSimple
	var err error
	switch {
	case c.Query("name") != "":
		qs, err = h.Net.QueueSimpleByName(ctx, c.Query("name"))
	case c.Query("dynamic") == "false":
		qs, err = h.Net.QueueSimpleStatic(ctx)
	default:
		qs, err = h.Net.QueueSimpleList(ctx)
	}
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := dto.FromDomainQueues(qs)
	WriteList(c, out, len(out))
}

func (h *NetworkQueue) Delete(c *gin.Context) {
	if err := h.Net.QueueSimpleRemove(c.Request.Context(), c.Param("id")); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}
