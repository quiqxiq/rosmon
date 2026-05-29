package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/service/auth"
)

// Users handler untuk endpoint /auth/users (admin only — middleware-enforced).
type Users struct {
	Svc *auth.Service
}

// NewUsers constructor.
func NewUsers(svc *auth.Service) *Users { return &Users{Svc: svc} }

// Register mount semua endpoint /auth/users/* di group g.
func (h *Users) Register(g *gin.RouterGroup) {
	users := g.Group("/auth/users")
	users.GET("", h.List)
	users.POST("", h.Create)
	users.GET("/:id", h.Get)
	users.PUT("/:id", h.Update)
	users.DELETE("/:id", h.Delete)
}

func (h *Users) List(c *gin.Context) {
	us, err := h.Svc.ListUsers(c.Request.Context())
	if err != nil {
		WriteErr(c, err)
		return
	}
	out := make([]dto.UserResponse, len(us))
	for i, u := range us {
		out[i] = dto.FromModelUser(u)
	}
	WriteList(c, out, len(out))
}

func (h *Users) Get(c *gin.Context) {
	id, err := parseUserID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Err("INVALID_ID", "invalid user id", c.Param("id")))
		return
	}
	u, err := h.Svc.GetUser(c.Request.Context(), id)
	if err != nil {
		writeAuthErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelUser(u))
}

func (h *Users) Create(c *gin.Context) {
	var req dto.UserCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	active := true
	if req.Active != nil {
		active = *req.Active
	}
	u, err := h.Svc.CreateUser(c.Request.Context(), auth.CreateUserInput{
		Username: req.Username,
		Email:    req.Email,
		Password: req.Password,
		Role:     req.Role,
		Active:   active,
	})
	if err != nil {
		writeAuthErr(c, err)
		return
	}
	WriteCreated(c, dto.FromModelUser(u))
}

func (h *Users) Update(c *gin.Context) {
	id, err := parseUserID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Err("INVALID_ID", "invalid user id", c.Param("id")))
		return
	}
	var req dto.UserUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	u, err := h.Svc.UpdateUser(c.Request.Context(), id, auth.UpdateUserInput{
		Email:    req.Email,
		Password: req.Password,
		Role:     req.Role,
		Active:   req.Active,
	})
	if err != nil {
		writeAuthErr(c, err)
		return
	}
	WriteOK(c, dto.FromModelUser(u))
}

func (h *Users) Delete(c *gin.Context) {
	id, err := parseUserID(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, dto.Err("INVALID_ID", "invalid user id", c.Param("id")))
		return
	}
	if err := h.Svc.DeleteUser(c.Request.Context(), id); err != nil {
		writeAuthErr(c, err)
		return
	}
	WriteNoContent(c)
}

func parseUserID(c *gin.Context) (uint, error) {
	n, err := strconv.ParseUint(c.Param("id"), 10, 64)
	return uint(n), err
}
