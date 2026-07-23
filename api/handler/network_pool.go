package handler

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/domain"
	"github.com/quiqxiq/rosmon/mikrotik/network"
)

type NetworkPool struct{ Net *network.Client }

func NewNetworkPool(net *network.Client) *NetworkPool { return &NetworkPool{Net: net} }

func (h *NetworkPool) Register(g *gin.RouterGroup) {
	h.RegisterSplit(g, g)
}

func (h *NetworkPool) RegisterSplit(readGroup, writeGroup *gin.RouterGroup) {
	mk := func(c *gin.Context) *NetworkPool { return NewNetworkPool(mustClients(c).Net) }
	r := readGroup.Group("/network/pools")
	r.GET("", func(c *gin.Context) { mk(c).List(c) })
	r.GET("/by-name/:name", func(c *gin.Context) { mk(c).GetByName(c) })

	w := writeGroup.Group("/network/pools")
	w.POST("", func(c *gin.Context) { mk(c).Create(c) })
	w.PUT("/:id", func(c *gin.Context) { mk(c).Update(c) })
	w.DELETE("/:id", func(c *gin.Context) { mk(c).Delete(c) })
}

// List → §1.10.
func (h *NetworkPool) List(c *gin.Context) {
	ctx := c.Request.Context()
	ttl, useCache := parseCacheQuery(c, 5*time.Minute)
	var ps []domain.IPPool
	var err error
	if useCache {
		ps, err = h.Net.PoolListCached(ctx, ttl)
	} else {
		ps, err = h.Net.IPPoolList(ctx)
	}
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := dto.FromDomainPools(ps)
	WriteList(c, out, len(out))
}

// GetByName → §1.10.
func (h *NetworkPool) GetByName(c *gin.Context) {
	p, err := h.Net.IPPoolByName(c.Request.Context(), c.Param("name"))
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromDomainPool(p))
}

// Create → §1.10.
func (h *NetworkPool) Create(c *gin.Context) {
	var req dto.IPPoolCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	id, err := h.Net.IPPoolAdd(c.Request.Context(), req.ToArgs())
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteCreated(c, dto.IDResponse{ID: id})
}

// Update → §1.10.
func (h *NetworkPool) Update(c *gin.Context) {
	var req dto.IPPoolUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if err := h.Net.IPPoolSet(c.Request.Context(), req.ToArgs(c.Param("id"))); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

// Delete → §1.10.
func (h *NetworkPool) Delete(c *gin.Context) {
	if err := h.Net.IPPoolRemove(c.Request.Context(), c.Param("id")); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}
