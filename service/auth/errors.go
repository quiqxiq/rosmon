// Package auth menyediakan service autentikasi (JWT access + refresh,
// bcrypt password, RBAC 3-role) dan CRUD user untuk rosmon.
//
// Penggunaan: cmd/server membangun Signer (JWT) + Service (orchestrator),
// inject ke api.Deps. Middleware api/middleware/auth.go verify Bearer
// token tiap request authenticated.
package auth

import "errors"

var (
	ErrInvalidCredentials = errors.New("auth: invalid credentials")
	ErrTokenExpired       = errors.New("auth: token expired")
	ErrTokenInvalid       = errors.New("auth: token invalid")
	ErrTokenWrongType     = errors.New("auth: token wrong type")
	ErrRefreshRevoked     = errors.New("auth: refresh token revoked")
	ErrUserExists         = errors.New("auth: username already exists")
	ErrUserNotFound       = errors.New("auth: user not found")
	ErrUserInactive       = errors.New("auth: user inactive")
	ErrRoleInvalid        = errors.New("auth: role invalid")
	ErrRoleRequired       = errors.New("auth: role not authorized")
	ErrWeakPassword       = errors.New("auth: password too short (min 8 chars)")
)

// Role yang valid. Hierarki: admin > operator > viewer.
const (
	RoleAdmin    = "admin"
	RoleOperator = "operator"
	RoleViewer   = "viewer"
)

// ValidRoles returns set role yang dikenali sistem.
func ValidRoles() []string { return []string{RoleAdmin, RoleOperator, RoleViewer} }

// IsValidRole cek apakah r adalah role yang valid.
func IsValidRole(r string) bool {
	switch r {
	case RoleAdmin, RoleOperator, RoleViewer:
		return true
	}
	return false
}
