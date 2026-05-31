package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/quiqxiq/rosmon/api/dto"
	"github.com/quiqxiq/rosmon/service/auth"
	"github.com/quiqxiq/rosmon/service/portal"
)

// CustomerAuth handler — login publik untuk customer portal.
type CustomerAuth struct {
	Portal *portal.CustomerAuth
	Signer *auth.Signer
}

func NewCustomerAuth(p *portal.CustomerAuth, signer *auth.Signer) *CustomerAuth {
	return &CustomerAuth{Portal: p, Signer: signer}
}

// RegisterPublic memasang POST /customer/login (tanpa auth, IP rate-limited).
func (h *CustomerAuth) RegisterPublic(g *gin.RouterGroup) {
	g.POST("/customer/login", h.Login)
}

func (h *CustomerAuth) Login(c *gin.Context) {
	var req dto.CustomerLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		WriteValidationErr(c, err)
		return
	}
	token, cust, err := h.Portal.Login(c.Request.Context(), req.Phone, req.Password)
	if err != nil {
		if errors.Is(err, auth.ErrInvalidCredentials) {
			c.AbortWithStatusJSON(http.StatusUnauthorized,
				dto.Err("UNAUTHORIZED", "nomor HP atau password salah", c.Request.URL.Path))
			return
		}
		WriteErr(c, err)
		return
	}
	WriteOK(c, dto.CustomerLoginResponse{
		AccessToken: token,
		TokenType:   "Bearer",
		ExpiresIn:   int(h.Signer.CustomerTTL().Seconds()),
		Customer:    dto.FromModelCustomerMe(cust),
	})
}
