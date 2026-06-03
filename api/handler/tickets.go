package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/api/middleware"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
)

// Tickets handler — /tickets (staff) dan /customer/tickets (customer portal).
type Tickets struct {
	Store store.TicketStore
}

func NewTickets(s store.TicketStore) *Tickets { return &Tickets{Store: s} }

// RegisterStaff mounts endpoint staff — admin+operator dapat list semua, CRUD penuh.
func (h *Tickets) RegisterStaff(g *gin.RouterGroup) {
	r := g.Group("/tickets")
	r.GET("", h.List)
	r.GET("/:id", h.Get)
	r.POST("", h.Create)
	r.PATCH("/:id/status", h.PatchStatus)
	r.POST("/:id/assign", h.Assign)
	r.POST("/:id/resolve", h.Resolve)
	r.DELETE("/:id", h.Delete)
}

// RegisterCustomer mounts endpoint customer portal — pelanggan hanya bisa buat + lihat tiket sendiri.
func (h *Tickets) RegisterCustomer(g *gin.RouterGroup) {
	r := g.Group("/customer/tickets")
	r.GET("", h.ListMine)
	r.POST("", h.CreateMine)
}

func (h *Tickets) List(c *gin.Context) {
	f := store.TicketListFilter{Status: c.Query("status")}
	if v := c.Query("customer_id"); v != "" {
		if n, err := strconv.ParseUint(v, 10, 64); err == nil {
			f.CustomerID = uint(n)
		}
	}
	tickets, err := h.Store.List(c.Request.Context(), f)
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.TicketResponse, len(tickets))
	for i, t := range tickets {
		out[i] = dto.FromModelTicket(t)
	}
	WriteList(c, out, len(out))
}

func (h *Tickets) Get(c *gin.Context) {
	id, ok := parseTicketID(c)
	if !ok {
		return
	}
	t, err := h.Store.GetByID(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrTicketNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, dto.Err("NOT_FOUND", "ticket not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelTicket(*t))
}

func (h *Tickets) Create(c *gin.Context) {
	var req dto.TicketCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	t := &model.Ticket{
		CustomerID: req.CustomerID,
		Subject:    req.Subject,
		Body:       req.Body,
		Priority:   req.Priority,
	}
	if err := h.Store.Create(c.Request.Context(), t); err != nil {
		WriteErr(c, err)
		return
	}
	WriteCreated(c, dto.FromModelTicket(*t))
}

func (h *Tickets) PatchStatus(c *gin.Context) {
	id, ok := parseTicketID(c)
	if !ok {
		return
	}
	var req dto.TicketStatusPatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if err := h.Store.UpdateStatus(c.Request.Context(), id, req.Status); err != nil {
		if errors.Is(err, store.ErrTicketNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, dto.Err("NOT_FOUND", "ticket not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, gin.H{"message": "status updated"})
}

func (h *Tickets) Assign(c *gin.Context) {
	id, ok := parseTicketID(c)
	if !ok {
		return
	}
	var req dto.TicketAssignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if err := h.Store.Assign(c.Request.Context(), id, req.UserID); err != nil {
		if errors.Is(err, store.ErrTicketNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, dto.Err("NOT_FOUND", "ticket not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, gin.H{"message": "ticket assigned"})
}

func (h *Tickets) Resolve(c *gin.Context) {
	id, ok := parseTicketID(c)
	if !ok {
		return
	}
	var req dto.TicketResolveRequest
	_ = c.ShouldBindJSON(&req)
	if err := h.Store.Resolve(c.Request.Context(), id, req.StaffNotes); err != nil {
		if errors.Is(err, store.ErrTicketNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, dto.Err("NOT_FOUND", "ticket not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, gin.H{"message": "ticket resolved"})
}

func (h *Tickets) Delete(c *gin.Context) {
	id, ok := parseTicketID(c)
	if !ok {
		return
	}
	if err := h.Store.Delete(c.Request.Context(), id); err != nil {
		if errors.Is(err, store.ErrTicketNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound, dto.Err("NOT_FOUND", "ticket not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

// ── Customer portal endpoints ─────────────────────────────────────────────────

// ListMine list tiket milik customer yang sedang login.
func (h *Tickets) ListMine(c *gin.Context) {
	custClaims, ok := middleware.CustomerClaimsFrom(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, dto.Err("UNAUTHORIZED", "not authenticated", c.Request.URL.Path))
		return
	}
	tickets, err := h.Store.List(c.Request.Context(), store.TicketListFilter{CustomerID: custClaims.CustomerID})
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.TicketResponse, len(tickets))
	for i, t := range tickets {
		out[i] = dto.FromModelTicket(t)
		out[i].StaffNotes = "" // tidak ekspos ke customer
	}
	WriteList(c, out, len(out))
}

// CreateMine buat tiket baru dari customer yang sedang login.
func (h *Tickets) CreateMine(c *gin.Context) {
	custClaims, ok := middleware.CustomerClaimsFrom(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized, dto.Err("UNAUTHORIZED", "not authenticated", c.Request.URL.Path))
		return
	}
	var req struct {
		Subject  string `json:"subject"  binding:"required,min=3,max=200"`
		Body     string `json:"body"`
		Priority string `json:"priority"` // optional
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	t := &model.Ticket{
		CustomerID: custClaims.CustomerID,
		Subject:    req.Subject,
		Body:       req.Body,
		Priority:   req.Priority,
	}
	if err := h.Store.Create(c.Request.Context(), t); err != nil {
		WriteErr(c, err)
		return
	}
	out := dto.FromModelTicket(*t)
	out.StaffNotes = ""
	WriteCreated(c, out)
}

func parseTicketID(c *gin.Context) (uint, bool) {
	raw := c.Param("id")
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest, dto.Err("INVALID_ID", "invalid ticket id", raw))
		return 0, false
	}
	return uint(n), true
}
