package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/api/middleware"
	"github.com/quiqxiq/rosmon/service/auth"
	"github.com/quiqxiq/rosmon/store/model"
)

// Auth handler untuk endpoint /auth/login, /auth/refresh, /auth/logout, /auth/me.
type Auth struct {
	Svc *auth.Service
}

// NewAuth constructor.
func NewAuth(svc *auth.Service) *Auth { return &Auth{Svc: svc} }

// RegisterPublic mount endpoint yang TIDAK butuh authentication.
// /auth/login, /auth/refresh, /auth/logout.
func (h *Auth) RegisterPublic(g *gin.RouterGroup) {
	g.POST("/auth/login", h.Login)
	g.POST("/auth/refresh", h.Refresh)
	g.POST("/auth/logout", h.Logout)
}

// RegisterProtected mount endpoint yang butuh access token.
// /auth/me.
func (h *Auth) RegisterProtected(g *gin.RouterGroup) {
	g.GET("/auth/me", h.Me)
	g.PUT("/auth/me", h.UpdateMe)
}

func (h *Auth) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	pair, user, err := h.Svc.Login(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		writeAuthErr(c, err)
		return
	}
	WriteOK(c, tokenResponseFromPair(pair, user))
}

func (h *Auth) Refresh(c *gin.Context) {
	var req dto.RefreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	pair, user, err := h.Svc.Refresh(c.Request.Context(), req.RefreshToken)
	if err != nil {
		writeAuthErr(c, err)
		return
	}
	WriteOK(c, tokenResponseFromPair(pair, user))
}

func (h *Auth) Logout(c *gin.Context) {
	var req dto.LogoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if err := h.Svc.Logout(c.Request.Context(), req.RefreshToken); err != nil {
		WriteErr(c, err)
		return
	}
	WriteNoContent(c)
}

func (h *Auth) Me(c *gin.Context) {
	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized,
			dto.Err("UNAUTHORIZED", "no auth context", c.Request.URL.Path))
		return
	}
	u, err := h.Svc.GetUser(c.Request.Context(), claims.UserID)
	if err != nil {
		writeAuthErr(c, err)
		return
	}
	WriteOK(c, dto.MeResponse{UserResponse: dto.FromModelUser(u)})
}

func (h *Auth) UpdateMe(c *gin.Context) {
	claims, ok := middleware.ClaimsFrom(c)
	if !ok {
		c.AbortWithStatusJSON(http.StatusUnauthorized,
			dto.Err("UNAUTHORIZED", "no auth context", c.Request.URL.Path))
		return
	}
	var req dto.UpdateMeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	if req.NewPassword != "" && req.CurrentPassword == "" {
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("INVALID_REQUEST", "current_password wajib diisi untuk mengganti password", c.Request.URL.Path))
		return
	}
	u, err := h.Svc.UpdateMe(c.Request.Context(), claims.UserID, auth.UpdateMeInput{
		Email:           req.Email,
		CurrentPassword: req.CurrentPassword,
		NewPassword:     req.NewPassword,
	})
	if err != nil {
		writeAuthErr(c, err)
		return
	}
	WriteOK(c, dto.MeResponse{UserResponse: dto.FromModelUser(u)})
}

func tokenResponseFromPair(pair auth.TokenPair, user model.User) dto.TokenResponse {
	expiresIn := int(time.Until(pair.AccessExpiresAt).Seconds())
	if expiresIn < 0 {
		expiresIn = 0
	}
	return dto.TokenResponse{
		AccessToken:      pair.AccessToken,
		RefreshToken:     pair.RefreshToken,
		TokenType:        "Bearer",
		ExpiresIn:        expiresIn,
		AccessExpiresAt:  pair.AccessExpiresAt,
		RefreshExpiresAt: pair.RefreshExpiresAt,
		User:             dto.FromModelUser(user),
	}
}

// writeAuthErr map auth.Err* → HTTP status + envelope.
func writeAuthErr(c *gin.Context, err error) {
	path := c.Request.URL.Path
	switch {
	case errors.Is(err, auth.ErrInvalidCredentials):
		c.AbortWithStatusJSON(http.StatusUnauthorized,
			dto.Err("INVALID_CREDENTIALS", "invalid username or password", path))
	case errors.Is(err, auth.ErrUserInactive):
		c.AbortWithStatusJSON(http.StatusForbidden,
			dto.Err("USER_INACTIVE", "user account inactive", path))
	case errors.Is(err, auth.ErrTokenExpired):
		c.AbortWithStatusJSON(http.StatusUnauthorized,
			dto.Err("TOKEN_EXPIRED", "token expired", path))
	case errors.Is(err, auth.ErrTokenWrongType):
		c.AbortWithStatusJSON(http.StatusUnauthorized,
			dto.Err("TOKEN_WRONG_TYPE", "wrong token type", path))
	case errors.Is(err, auth.ErrTokenInvalid):
		c.AbortWithStatusJSON(http.StatusUnauthorized,
			dto.Err("TOKEN_INVALID", "token invalid", path))
	case errors.Is(err, auth.ErrRefreshRevoked):
		c.AbortWithStatusJSON(http.StatusUnauthorized,
			dto.Err("REFRESH_REVOKED", "refresh token revoked", path))
	case errors.Is(err, auth.ErrUserExists):
		c.AbortWithStatusJSON(http.StatusConflict,
			dto.Err("USER_EXISTS", "username already exists", path))
	case errors.Is(err, auth.ErrUserNotFound):
		c.AbortWithStatusJSON(http.StatusNotFound,
			dto.Err("USER_NOT_FOUND", "user not found", path))
	case errors.Is(err, auth.ErrRoleInvalid):
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("ROLE_INVALID", "role invalid", path))
	case errors.Is(err, auth.ErrWeakPassword):
		c.AbortWithStatusJSON(http.StatusBadRequest,
			dto.Err("WEAK_PASSWORD", "password too short", path))
	default:
		WriteErr(c, err)
	}
}
