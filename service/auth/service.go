package auth

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
)

// TokenPair gabungan access + refresh token + metadata expiry.
type TokenPair struct {
	AccessToken      string
	RefreshToken     string
	AccessExpiresAt  time.Time
	RefreshExpiresAt time.Time
}

// Service orchestrates login, refresh, logout, dan CRUD user.
type Service struct {
	Users   store.UserStore
	Tokens  store.RefreshTokenStore
	Hasher  *Hasher
	Signer  *Signer
	NowFunc func() time.Time // override-able untuk test
}

// New buat Service. NowFunc default time.Now.
func New(us store.UserStore, rs store.RefreshTokenStore, h *Hasher, s *Signer) *Service {
	return &Service{
		Users:   us,
		Tokens:  rs,
		Hasher:  h,
		Signer:  s,
		NowFunc: time.Now,
	}
}

func (s *Service) now() time.Time {
	if s.NowFunc != nil {
		return s.NowFunc()
	}
	return time.Now()
}

// Login verifikasi credentials lalu issue access+refresh. Refresh token
// dicatat di refresh_tokens (jti) untuk rotation/revocation.
func (s *Service) Login(ctx context.Context, username, password string) (TokenPair, model.User, error) {
	u, err := s.Users.GetByUsername(ctx, strings.TrimSpace(username))
	if err != nil {
		if errors.Is(err, store.ErrUserNotFound) {
			return TokenPair{}, model.User{}, ErrInvalidCredentials
		}
		return TokenPair{}, model.User{}, err
	}
	if !u.Active {
		return TokenPair{}, model.User{}, ErrUserInactive
	}
	if err := s.Hasher.Verify(u.Password, password); err != nil {
		return TokenPair{}, model.User{}, err
	}
	return s.issueTokens(ctx, u)
}

// Refresh tukar refresh token lama dengan pasangan baru. Rotation: jti
// lama di-revoke, jti baru di-Create. Token yang sudah revoked / expired
// di-tolak.
func (s *Service) Refresh(ctx context.Context, refreshToken string) (TokenPair, model.User, error) {
	claims, err := s.Signer.VerifyRefresh(refreshToken)
	if err != nil {
		return TokenPair{}, model.User{}, err
	}
	rec, err := s.Tokens.GetByJTI(ctx, claims.ID)
	if err != nil {
		if errors.Is(err, store.ErrRefreshTokenNotFound) {
			return TokenPair{}, model.User{}, ErrRefreshRevoked
		}
		return TokenPair{}, model.User{}, err
	}
	if rec.RevokedAt != nil {
		return TokenPair{}, model.User{}, ErrRefreshRevoked
	}
	if !rec.ExpiresAt.After(s.now()) {
		return TokenPair{}, model.User{}, ErrTokenExpired
	}
	u, err := s.Users.GetByID(ctx, claims.UserID)
	if err != nil {
		if errors.Is(err, store.ErrUserNotFound) {
			return TokenPair{}, model.User{}, ErrUserNotFound
		}
		return TokenPair{}, model.User{}, err
	}
	if !u.Active {
		return TokenPair{}, model.User{}, ErrUserInactive
	}
	// Rotate: revoke jti lama, issue jti baru.
	if err := s.Tokens.Revoke(ctx, claims.ID, s.now()); err != nil {
		return TokenPair{}, model.User{}, err
	}
	return s.issueTokens(ctx, u)
}

// Logout revoke refresh token (idempotent). Access token tidak di-blacklist
// — akan expire sendiri dalam <= access TTL.
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	claims, err := s.Signer.VerifyRefresh(refreshToken)
	if err != nil {
		// Token invalid → anggap sudah logout, sukses idempotent.
		return nil
	}
	if err := s.Tokens.Revoke(ctx, claims.ID, s.now()); err != nil && !errors.Is(err, store.ErrRefreshTokenNotFound) {
		return err
	}
	return nil
}

// issueTokens internal: bikin pair baru dan record refresh jti.
func (s *Service) issueTokens(ctx context.Context, u model.User) (TokenPair, model.User, error) {
	jti := NewJTI()
	refreshTok, refreshExp, err := s.Signer.SignRefresh(u.ID, u.Username, u.Role, jti)
	if err != nil {
		return TokenPair{}, model.User{}, err
	}
	accessTok, err := s.Signer.SignAccess(u.ID, u.Username, u.Role)
	if err != nil {
		return TokenPair{}, model.User{}, err
	}
	rec := &model.RefreshToken{
		JTI:       jti,
		UserID:    u.ID,
		ExpiresAt: refreshExp,
		CreatedAt: s.now(),
	}
	if err := s.Tokens.Create(ctx, rec); err != nil {
		return TokenPair{}, model.User{}, err
	}
	return TokenPair{
		AccessToken:      accessTok,
		RefreshToken:     refreshTok,
		AccessExpiresAt:  s.now().Add(s.Signer.AccessTTL()),
		RefreshExpiresAt: refreshExp,
	}, u, nil
}

// CreateUserInput parameter constructor.
type CreateUserInput struct {
	Username string
	Email    string
	Password string
	Role     string
	Active   bool
}

// CreateUser buat user baru dengan password ter-hash.
func (s *Service) CreateUser(ctx context.Context, in CreateUserInput) (model.User, error) {
	in.Username = strings.TrimSpace(in.Username)
	in.Email = strings.TrimSpace(in.Email)
	if in.Username == "" {
		return model.User{}, ErrInvalidCredentials
	}
	if !IsValidRole(in.Role) {
		return model.User{}, ErrRoleInvalid
	}
	hash, err := s.Hasher.Hash(in.Password)
	if err != nil {
		return model.User{}, err
	}
	u := model.User{
		Username: in.Username,
		Email:    in.Email,
		Password: hash,
		Role:     in.Role,
		Active:   in.Active,
	}
	if err := s.Users.Create(ctx, &u); err != nil {
		// gorm unique violation → map ke ErrUserExists.
		if isUniqueViolation(err) {
			return model.User{}, ErrUserExists
		}
		return model.User{}, err
	}
	return u, nil
}

// UpdateUserInput field opsional — kosong = jangan ubah. Password kalau
// diisi, di-hash sebelum simpan.
type UpdateUserInput struct {
	Email    *string
	Role     *string
	Active   *bool
	Password *string
}

// UpdateUser update field selektif.
func (s *Service) UpdateUser(ctx context.Context, id uint, in UpdateUserInput) (model.User, error) {
	u, err := s.Users.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, store.ErrUserNotFound) {
			return model.User{}, ErrUserNotFound
		}
		return model.User{}, err
	}
	if in.Email != nil {
		u.Email = strings.TrimSpace(*in.Email)
	}
	if in.Role != nil {
		if !IsValidRole(*in.Role) {
			return model.User{}, ErrRoleInvalid
		}
		u.Role = *in.Role
	}
	if in.Active != nil {
		u.Active = *in.Active
	}
	if in.Password != nil {
		hash, err := s.Hasher.Hash(*in.Password)
		if err != nil {
			return model.User{}, err
		}
		u.Password = hash
	}
	if err := s.Users.Update(ctx, &u); err != nil {
		return model.User{}, err
	}
	// Kalau user di-deactivate / password berubah / role berubah, revoke
	// semua refresh token aktif supaya effect langsung terasa.
	if in.Active != nil && !*in.Active || in.Password != nil || in.Role != nil {
		if err := s.Tokens.RevokeAllForUser(ctx, u.ID, s.now()); err != nil {
			return u, err
		}
	}
	return u, nil
}

// DeleteUser hapus user (soft delete via gorm.DeletedAt). Revoke semua
// refresh token user supaya tidak bisa pakai sisa session.
func (s *Service) DeleteUser(ctx context.Context, id uint) error {
	if err := s.Tokens.RevokeAllForUser(ctx, id, s.now()); err != nil {
		return err
	}
	return s.Users.Delete(ctx, id)
}

// GetUser ambil by ID.
func (s *Service) GetUser(ctx context.Context, id uint) (model.User, error) {
	u, err := s.Users.GetByID(ctx, id)
	if errors.Is(err, store.ErrUserNotFound) {
		return u, ErrUserNotFound
	}
	return u, err
}

// UpdateMeInput parameter untuk self-update (PUT /auth/me). Semua field opsional.
// Jika NewPassword diisi, CurrentPassword wajib diisi dan harus cocok.
type UpdateMeInput struct {
	Email           string
	CurrentPassword string
	NewPassword     string
}

// UpdateMe update profil pengguna sendiri. Password berubah hanya jika
// NewPassword diisi dan CurrentPassword cocok.
func (s *Service) UpdateMe(ctx context.Context, userID uint, in UpdateMeInput) (model.User, error) {
	u, err := s.Users.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, store.ErrUserNotFound) {
			return model.User{}, ErrUserNotFound
		}
		return model.User{}, err
	}

	inp := UpdateUserInput{}

	if in.Email != "" {
		inp.Email = &in.Email
	}

	if in.NewPassword != "" {
		if err := s.Hasher.Verify(u.Password, in.CurrentPassword); err != nil {
			return model.User{}, ErrInvalidCredentials
		}
		inp.Password = &in.NewPassword
	}

	return s.UpdateUser(ctx, userID, inp)
}

// ListUsers list semua user.
func (s *Service) ListUsers(ctx context.Context) ([]model.User, error) {
	return s.Users.List(ctx)
}

// BootstrapAdmin buat user admin pertama kalau ADMIN_USERNAME + ADMIN_PASSWORD
// di env DAN belum ada user di tabel. Idempotent: skip kalau sudah ada user.
func (s *Service) BootstrapAdmin(ctx context.Context, username, password string) error {
	username = strings.TrimSpace(username)
	password = strings.TrimSpace(password)
	if username == "" || password == "" {
		return nil // tidak di-config, skip
	}
	existing, err := s.Users.List(ctx)
	if err != nil {
		return err
	}
	if len(existing) > 0 {
		return nil // sudah ada user, jangan overwrite
	}
	_, err = s.CreateUser(ctx, CreateUserInput{
		Username: username,
		Password: password,
		Role:     RoleAdmin,
		Active:   true,
	})
	return err
}

// isUniqueViolation cek heuristik error message GORM untuk unique index.
// Pendekatan ini agnostik DBMS (postgres "duplicate key", sqlite "UNIQUE
// constraint", mysql "Duplicate entry").
func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate") || strings.Contains(msg, "unique constraint") || strings.Contains(msg, "unique violation")
}
