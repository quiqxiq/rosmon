package handler

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/api/middleware"
	"github.com/quiqxiq/rosmon/service/audit"
	"github.com/quiqxiq/rosmon/service/auth"
	"github.com/quiqxiq/rosmon/service/portal"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
)

// Customers handler untuk endpoint /customers (top-level, tidak per-device).
// Resource ini murni DB — tidak ada interaksi dengan router MikroTik.
type Customers struct {
	Store store.CustomerStore
	// PortalAuth + Audit opsional (nil-safe) — dipakai endpoint admin
	// set-portal-password (onboarding pelanggan ke customer portal).
	PortalAuth *portal.CustomerAuth
	Audit      store.AuditLogStore
}

func NewCustomers(s store.CustomerStore) *Customers { return &Customers{Store: s} }

func (h *Customers) Register(g *gin.RouterGroup) {
	r := g.Group("/customers")
	r.GET("", h.List)
	r.POST("", h.Create)
	r.GET("/:id", h.Get)
	r.PUT("/:id", h.Update)
}

// RegisterMutate mount endpoint yang butuh admin/operator: DELETE /customers/:id.
func (h *Customers) RegisterMutate(g *gin.RouterGroup) {
	r := g.Group("/customers")
	r.DELETE("/:id", h.Delete)
}

// RegisterAdmin memasang endpoint sensitif (admin+operator) — dipanggil dari
// routes.go di grup ber-RequireRole.
func (h *Customers) RegisterAdmin(g *gin.RouterGroup) {
	g.POST("/customers/:id/portal-password", h.SetPortalPassword)
}

// SetPortalPassword — admin set/reset password login portal pelanggan.
func (h *Customers) SetPortalPassword(c *gin.Context) {
	if h.PortalAuth == nil {
		c.AbortWithStatusJSON(http.StatusServiceUnavailable,
			dto.Err("SERVICE_UNAVAILABLE", "customer portal not configured", c.Request.URL.Path))
		return
	}
	id, ok := parseCustomerID(c)
	if !ok {
		return
	}
	var req dto.SetPortalPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if err := h.PortalAuth.SetPassword(c.Request.Context(), id, req.Password); err != nil {
		switch {
		case errors.Is(err, store.ErrCustomerNotFound):
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "customer not found", c.Request.URL.Path))
		case errors.Is(err, auth.ErrWeakPassword):
			c.AbortWithStatusJSON(http.StatusBadRequest,
				dto.Err("INVALID_ARGUMENT", "password minimal 8 karakter", c.Request.URL.Path))
		default:
			WriteErr(c, err)
		}
		return
	}
	if h.Audit != nil {
		var actor *uint
		if claims, okC := middleware.ClaimsFrom(c); okC {
			uid := claims.UserID
			actor = &uid
		}
		audit.Log(c.Request.Context(), h.Audit, nil, actor, "set_portal_password", "customer", id, nil, nil)
	}
	WriteOK(c, gin.H{"message": "portal password set"})
}

func (h *Customers) List(c *gin.Context) {
	f := store.CustomerListFilter{
		Status: c.Query("status"),
		Area:   c.Query("area"),
		Q:      c.Query("q"),
	}
	items, err := h.Store.List(c.Request.Context(), f)
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.CustomerResponse, len(items))
	for i, it := range items {
		out[i] = dto.FromModelCustomer(it)
	}
	WriteList(c, out, len(out))
}

func (h *Customers) Get(c *gin.Context) {
	id, ok := parseCustomerID(c)
	if !ok {
		return
	}
	cust, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrCustomerNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "customer not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelCustomer(cust))
}

func (h *Customers) Create(c *gin.Context) {
	var req dto.CustomerCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	cust := &model.Customer{
		FullName: req.FullName,
		Phone:    req.Phone,
		Address:  req.Address,
		Area:     req.Area,
		Notes:    req.Notes,
		Status:   req.Status,
	}
	if claims, ok := middleware.ClaimsFrom(c); ok {
		uid := claims.UserID
		cust.CreatedBy = &uid
	}
	if err := h.Store.Create(c.Request.Context(), cust); err != nil {
		if errors.Is(err, store.ErrCustomerPhoneTaken) {
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", "phone already registered", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteCreated(c, dto.FromModelCustomer(*cust))
}

func (h *Customers) Update(c *gin.Context) {
	id, ok := parseCustomerID(c)
	if !ok {
		return
	}
	var req dto.CustomerUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	cust, err := h.Store.Get(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, store.ErrCustomerNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "customer not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	if req.FullName != nil {
		cust.FullName = *req.FullName
	}
	if req.Phone != nil {
		cust.Phone = *req.Phone
	}
	if req.Address != nil {
		cust.Address = *req.Address
	}
	if req.Area != nil {
		cust.Area = *req.Area
	}
	if req.Notes != nil {
		cust.Notes = *req.Notes
	}
	if req.Status != nil {
		cust.Status = *req.Status
	}
	if err := h.Store.Update(c.Request.Context(), &cust); err != nil {
		if errors.Is(err, store.ErrCustomerPhoneTaken) {
			c.AbortWithStatusJSON(http.StatusConflict,
				dto.Err("CONFLICT", "phone already registered", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelCustomer(cust))
}

func (h *Customers) Delete(c *gin.Context) {
	id, ok := parseCustomerID(c)
	if !ok {
		return
	}
	if err := h.Store.Delete(c.Request.Context(), id); err != nil {
		if errors.Is(err, store.ErrCustomerNotFound) {
			c.AbortWithStatusJSON(http.StatusNotFound,
				dto.Err("NOT_FOUND", "customer not found", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func parseCustomerID(c *gin.Context) (uint, bool) {
	raw := c.Param("id")
	n, err := strconv.ParseUint(raw, 10, 64)
	if err != nil {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_ID", "invalid customer id", raw))
		return 0, false
	}
	return uint(n), true
}
