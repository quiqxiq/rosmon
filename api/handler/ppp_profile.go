package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/mikrotik/ppp"
)

type PPPProfile struct{ PPP *ppp.Client }

func NewPPPProfile(pp *ppp.Client) *PPPProfile { return &PPPProfile{PPP: pp} }

func (h *PPPProfile) Register(g *gin.RouterGroup) {
	h.RegisterSplit(g, g)
}

func (h *PPPProfile) RegisterSplit(readGroup, writeGroup *gin.RouterGroup) {
	mk := func(c *gin.Context) *PPPProfile { return NewPPPProfile(mustClients(c).PPP) }
	r := readGroup.Group("/ppp/profiles")
	r.GET("", func(c *gin.Context) { mk(c).List(c) })
	r.GET("/by-name/:name", func(c *gin.Context) { mk(c).GetByName(c) })

	w := writeGroup.Group("/ppp/profiles")
	w.POST("", func(c *gin.Context) { mk(c).Create(c) })
	w.PUT("/:id", func(c *gin.Context) { mk(c).Update(c) })
	w.DELETE("/:id", func(c *gin.Context) { mk(c).Delete(c) })
}

func (h *PPPProfile) List(c *gin.Context) {
	ps, err := h.PPP.ProfileList(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := dto.FromDomainPPPProfiles(ps)
	WriteList(c, out, len(out))
}

func (h *PPPProfile) GetByName(c *gin.Context) {
	p, err := h.PPP.ProfileByName(c.Request.Context(), c.Param("name"))
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromDomainPPPProfile(p))
}

func (h *PPPProfile) Create(c *gin.Context) {
	var req dto.RouterPPPProfileCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	id, err := h.PPP.ProfileAdd(c.Request.Context(), req.ToArgs())
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteCreated(c, dto.IDResponse{ID: id})
}

func (h *PPPProfile) Update(c *gin.Context) {
	var req dto.RouterPPPProfileUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if err := h.PPP.ProfileSet(c.Request.Context(), req.ToArgs(c.Param("id"))); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func (h *PPPProfile) Delete(c *gin.Context) {
	if err := h.PPP.ProfileRemove(c.Request.Context(), c.Param("id")); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}
