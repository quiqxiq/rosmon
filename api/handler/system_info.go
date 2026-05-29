package handler

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/mikrotik/system"
)

type SystemInfo struct{ Sys *system.Client }

func NewSystemInfo(sys *system.Client) *SystemInfo { return &SystemInfo{Sys: sys} }

func (h *SystemInfo) Register(g *gin.RouterGroup) {
	mk := func(c *gin.Context) *SystemInfo { return NewSystemInfo(mustClients(c).Sys) }
	g.GET("/system/identity", func(c *gin.Context) { mk(c).Identity(c) })
	g.GET("/system/resource", func(c *gin.Context) { mk(c).Resource(c) })
	g.GET("/system/routerboard", func(c *gin.Context) { mk(c).Routerboard(c) })
	g.GET("/system/clock", func(c *gin.Context) { mk(c).Clock(c) })
	g.GET("/system/license", func(c *gin.Context) { mk(c).License(c) })
}

func (h *SystemInfo) Identity(c *gin.Context) {
	ctx := c.Request.Context()
	ttl, useCache := parseCacheQuery(c, 5*time.Minute)
	if useCache {
		i, err := h.Sys.IdentityCached(ctx, ttl)
		if err != nil {
			WriteErr(c, err)
			return
		}
		WriteOK(c, dto.FromDomainIdentity(i))
		return
	}
	i, err := h.Sys.Identity(ctx)
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromDomainIdentity(i))
}

func (h *SystemInfo) Resource(c *gin.Context) {
	r, err := h.Sys.Resource(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromDomainResource(r))
}

func (h *SystemInfo) Routerboard(c *gin.Context) {
	r, err := h.Sys.Routerboard(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromDomainRouterboard(r))
}

func (h *SystemInfo) Clock(c *gin.Context) {
	clk, err := h.Sys.Clock(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromDomainClock(clk))
}

func (h *SystemInfo) License(c *gin.Context) {
	l, err := h.Sys.License(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromDomainLicense(l))
}
