package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/mikrotik/ppp"
)

type PPPSecret struct{ PPP *ppp.Client }

func NewPPPSecret(pp *ppp.Client) *PPPSecret { return &PPPSecret{PPP: pp} }

func (h *PPPSecret) Register(g *gin.RouterGroup) {
	h.RegisterSplit(g, g)
}

func (h *PPPSecret) RegisterSplit(readGroup, writeGroup *gin.RouterGroup) {
	mk := func(c *gin.Context) *PPPSecret { return NewPPPSecret(mustClients(c).PPP) }
	r := readGroup.Group("/ppp/secrets")
	r.GET("", func(c *gin.Context) { mk(c).List(c) })
	r.GET("/by-name/:name", func(c *gin.Context) { mk(c).GetByName(c) })

	w := writeGroup.Group("/ppp/secrets")
	w.POST("", func(c *gin.Context) { mk(c).Create(c) })
	w.POST("/batch-delete", func(c *gin.Context) { mk(c).BatchDelete(c) })
	w.POST("/bulk-delete", func(c *gin.Context) { mk(c).BatchDelete(c) })
	w.PUT("/:id", func(c *gin.Context) { mk(c).Update(c) })
	w.PATCH("/:id/disabled", func(c *gin.Context) { mk(c).SetDisabled(c) })
	w.DELETE("/:id", func(c *gin.Context) { mk(c).Delete(c) })
}

// RegisterAdmin memasang endpoint reveal password (admin+operator). Dipanggil
// dari routes.go di grup device-scoped ber-RequireRole.
func (h *PPPSecret) RegisterAdmin(g *gin.RouterGroup) {
	mk := func(c *gin.Context) *PPPSecret { return NewPPPSecret(mustClients(c).PPP) }
	g.GET("/ppp/secrets/:id/password", func(c *gin.Context) { mk(c).RevealPassword(c) })
}

// RevealPassword mengembalikan password plaintext sebuah PPP secret dari RouterOS.
func (h *PPPSecret) RevealPassword(c *gin.Context) {
	s, err := h.PPP.SecretByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.RevealPasswordResponse{Password: s.Password})
}

func (h *PPPSecret) List(c *gin.Context) {
	ss, err := h.PPP.SecretList(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := dto.FromDomainPPPSecrets(ss)
	WriteList(c, out, len(out))
}

func (h *PPPSecret) GetByName(c *gin.Context) {
	s, err := h.PPP.SecretByName(c.Request.Context(), c.Param("name"))
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromDomainPPPSecret(s))
}

func (h *PPPSecret) Create(c *gin.Context) {
	var req dto.PPPSecretCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	id, err := h.PPP.SecretAdd(c.Request.Context(), req.ToArgs())
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteCreated(c, dto.IDResponse{ID: id})
}

func (h *PPPSecret) Update(c *gin.Context) {
	var req dto.PPPSecretUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if err := h.PPP.SecretSet(c.Request.Context(), req.ToArgs(c.Param("id"))); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func (h *PPPSecret) SetDisabled(c *gin.Context) {
	var req dto.SetBoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if err := h.PPP.SecretSetDisabled(c.Request.Context(), c.Param("id"), req.Value); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func (h *PPPSecret) Delete(c *gin.Context) {
	if err := h.PPP.SecretRemove(c.Request.Context(), c.Param("id")); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func (h *PPPSecret) BatchDelete(c *gin.Context) {
	var req dto.BatchDeleteStringRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	var count int64
	for _, id := range req.IDs {
		if err := h.PPP.SecretRemove(c.Request.Context(), id); err == nil {
			count++
		}
	}
	WriteOK(c, dto.BatchDeleteResponse{Deleted: count})
}
