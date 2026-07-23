package handler

import (
	"errors"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/domain"
	"github.com/quiqxiq/rosmon/mikrotik/hotspot"
	"github.com/quiqxiq/rosmon/workflows"
)

// HotspotUser meng-handle /hotspot/users.
type HotspotUser struct {
	Hot *hotspot.Client
	WF  *workflows.Clients
}

func NewHotspotUser(hot *hotspot.Client, wf *workflows.Clients) *HotspotUser {
	return &HotspotUser{Hot: hot, WF: wf}
}

func (h *HotspotUser) Register(g *gin.RouterGroup) {
	h.RegisterSplit(g, g)
}

func (h *HotspotUser) RegisterSplit(readGroup, writeGroup *gin.RouterGroup) {
	mk := func(c *gin.Context) *HotspotUser {
		cs := mustClients(c)
		return NewHotspotUser(cs.Hot, cs.WF)
	}
	r := readGroup.Group("/hotspot/users")
	r.GET("", func(c *gin.Context) { mk(c).List(c) })
	r.GET("/count", func(c *gin.Context) { mk(c).Count(c) })
	r.GET("/by-name/:name", func(c *gin.Context) { mk(c).GetByName(c) })
	r.GET("/:id", func(c *gin.Context) { mk(c).Get(c) })

	w := writeGroup.Group("/hotspot/users")
	w.POST("", func(c *gin.Context) { mk(c).Create(c) })
	w.PUT("/:id", func(c *gin.Context) { mk(c).Update(c) })
	w.PATCH("/:id/disabled", func(c *gin.Context) { mk(c).SetDisabled(c) })
	w.PATCH("/:id/expiry", func(c *gin.Context) { mk(c).SetExpiry(c) })
	w.PATCH("/:id/mac", func(c *gin.Context) { mk(c).SetMAC(c) })
	w.POST("/:id/reset-counters", func(c *gin.Context) { mk(c).ResetCounters(c) })
	w.POST("/:id/reset-usage", func(c *gin.Context) { mk(c).ResetUsage(c) })
	w.DELETE("/:id", func(c *gin.Context) { mk(c).Delete(c) })
	w.POST("/bulk-delete", func(c *gin.Context) { mk(c).BulkDelete(c) })
}

// RegisterAdmin memasang endpoint reveal password (admin+operator). Dipanggil
// dari routes.go di grup device-scoped ber-RequireRole.
func (h *HotspotUser) RegisterAdmin(g *gin.RouterGroup) {
	mk := func(c *gin.Context) *HotspotUser {
		cs := mustClients(c)
		return NewHotspotUser(cs.Hot, cs.WF)
	}
	g.GET("/hotspot/users/:id/password", func(c *gin.Context) { mk(c).RevealPassword(c) })
}

// RevealPassword mengembalikan password plaintext sebuah hotspot user dari RouterOS.
func (h *HotspotUser) RevealPassword(c *gin.Context) {
	u, err := h.Hot.UserByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.RevealPasswordResponse{Password: u.Password})
}

func (h *HotspotUser) List(c *gin.Context) {
	ctx := c.Request.Context()
	var (
		users []domain.HotspotUser
		err   error
	)
	switch {
	case c.Query("profile") != "":
		users, err = h.Hot.UserByProfile(ctx, c.Query("profile"))
	case c.Query("comment") != "":
		users, err = h.Hot.UserByComment(ctx, c.Query("comment"))
	default:
		users, err = h.Hot.UserList(ctx)
	}
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := dto.FromDomainUsers(users)
	WriteList(c, out, len(out))
}

func (h *HotspotUser) Count(c *gin.Context) {
	n, err := h.Hot.UserCount(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.CountResponse{Count: n})
}

func (h *HotspotUser) Get(c *gin.Context) {
	u, err := h.Hot.UserByID(c.Request.Context(), c.Param("id"))
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromDomainUser(u))
}

func (h *HotspotUser) GetByName(c *gin.Context) {
	u, err := h.Hot.UserByName(c.Request.Context(), c.Param("name"))
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromDomainUser(u))
}

func (h *HotspotUser) Create(c *gin.Context) {
	var req dto.HotspotUserCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	id, err := h.Hot.UserAdd(c.Request.Context(), req.ToArgs())
	if err != nil {
		WriteErr(c, err)
		return
	}
	WriteCreated(c, dto.IDResponse{ID: id})
}

func (h *HotspotUser) Update(c *gin.Context) {
	var req dto.HotspotUserUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if err := h.Hot.UserSet(c.Request.Context(), req.ToArgs(c.Param("id"))); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func (h *HotspotUser) SetDisabled(c *gin.Context) {
	var req dto.SetBoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if err := h.Hot.UserSetDisabled(c.Request.Context(), c.Param("id"), req.Value); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func (h *HotspotUser) SetExpiry(c *gin.Context) {
	var req dto.SetStringRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if err := h.Hot.UserSetExpiry(c.Request.Context(), c.Param("id"), req.Value); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func (h *HotspotUser) SetMAC(c *gin.Context) {
	var req dto.SetStringRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if err := h.Hot.UserSetMAC(c.Request.Context(), c.Param("id"), req.Value); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func (h *HotspotUser) ResetCounters(c *gin.Context) {
	if err := h.Hot.UserResetCounters(c.Request.Context(), c.Param("id")); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func (h *HotspotUser) ResetUsage(c *gin.Context) {
	if err := h.Hot.UserResetUsage(c.Request.Context(), c.Param("id")); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func (h *HotspotUser) Delete(c *gin.Context) {
	if err := workflows.DeleteUser(c.Request.Context(), h.WF, c.Param("id")); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func (h *HotspotUser) BulkDelete(c *gin.Context) {
	var req dto.BulkIDsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	ctx := c.Request.Context()
	err := workflows.BulkDeleteUsers(ctx, h.WF, req.IDs)

	// BulkDeleteUsers tidak fail-fast — selalu lanjut semua ID.
	// Kalau ada failure parsial, kita tetap return 200 dengan detail per-ID.
	result := dto.BulkResult{
		Succeeded: make([]string, 0, len(req.IDs)),
		Failed:    make(map[string]string),
	}
	if err != nil {
		var bulkErr *workflows.BulkDeleteUsersErr
		if errors.As(err, &bulkErr) {
			for id, e := range bulkErr.Failed {
				result.Failed[id] = e.Error()
			}
		} else {
			WriteErr(c, err)
			return
		}
	}
	// Kumpulkan succeeded: semua ID yang tidak ada di Failed map
	for _, id := range req.IDs {
		if _, failed := result.Failed[id]; !failed {
			result.Succeeded = append(result.Succeeded, id)
		}
	}
	WriteOK(c, dto.Envelope{
		Data: result,
		Meta: map[string]any{
			"total":         len(req.IDs),
			"success_count": len(result.Succeeded),
			"failed_count":  len(result.Failed),
		},
	})
}
