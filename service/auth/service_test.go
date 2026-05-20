package auth

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/quiqxiq/roslib-mikhmon/store"
	"github.com/quiqxiq/roslib-mikhmon/store/model"
)

// fakeUserStore adalah in-memory implementation untuk unit test cepat
// (tanpa testcontainers postgres).
type fakeUserStore struct {
	mu     sync.Mutex
	byID   map[uint]*model.User
	byName map[string]*model.User
	nextID uint
}

func newFakeUserStore() *fakeUserStore {
	return &fakeUserStore{
		byID:   make(map[uint]*model.User),
		byName: make(map[string]*model.User),
		nextID: 1,
	}
}

func (f *fakeUserStore) List(ctx context.Context) ([]model.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]model.User, 0, len(f.byID))
	for _, u := range f.byID {
		out = append(out, *u)
	}
	return out, nil
}

func (f *fakeUserStore) GetByID(ctx context.Context, id uint) (model.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if u, ok := f.byID[id]; ok {
		return *u, nil
	}
	return model.User{}, store.ErrUserNotFound
}

func (f *fakeUserStore) GetByUsername(ctx context.Context, username string) (model.User, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if u, ok := f.byName[username]; ok {
		return *u, nil
	}
	return model.User{}, store.ErrUserNotFound
}

func (f *fakeUserStore) Create(ctx context.Context, u *model.User) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.byName[u.Username]; ok {
		return errors.New("duplicate key: username")
	}
	u.ID = f.nextID
	f.nextID++
	u.CreatedAt = time.Now()
	u.UpdatedAt = u.CreatedAt
	cp := *u
	f.byID[u.ID] = &cp
	f.byName[u.Username] = &cp
	return nil
}

func (f *fakeUserStore) Update(ctx context.Context, u *model.User) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.byID[u.ID]; !ok {
		return store.ErrUserNotFound
	}
	u.UpdatedAt = time.Now()
	cp := *u
	f.byID[u.ID] = &cp
	f.byName[u.Username] = &cp
	return nil
}

func (f *fakeUserStore) Delete(ctx context.Context, id uint) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	u, ok := f.byID[id]
	if !ok {
		return store.ErrUserNotFound
	}
	delete(f.byID, id)
	delete(f.byName, u.Username)
	return nil
}

func (f *fakeUserStore) UpdatePassword(ctx context.Context, id uint, hash string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	u, ok := f.byID[id]
	if !ok {
		return store.ErrUserNotFound
	}
	u.Password = hash
	return nil
}

type fakeRefreshStore struct {
	mu     sync.Mutex
	byJTI  map[string]*model.RefreshToken
	nextID uint
}

func newFakeRefreshStore() *fakeRefreshStore {
	return &fakeRefreshStore{byJTI: make(map[string]*model.RefreshToken), nextID: 1}
}

func (f *fakeRefreshStore) Create(ctx context.Context, t *model.RefreshToken) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if _, ok := f.byJTI[t.JTI]; ok {
		return errors.New("duplicate jti")
	}
	t.ID = f.nextID
	f.nextID++
	cp := *t
	f.byJTI[t.JTI] = &cp
	return nil
}

func (f *fakeRefreshStore) GetByJTI(ctx context.Context, jti string) (model.RefreshToken, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if t, ok := f.byJTI[jti]; ok {
		return *t, nil
	}
	return model.RefreshToken{}, store.ErrRefreshTokenNotFound
}

func (f *fakeRefreshStore) Revoke(ctx context.Context, jti string, at time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	t, ok := f.byJTI[jti]
	if !ok {
		return store.ErrRefreshTokenNotFound
	}
	if t.RevokedAt != nil {
		return store.ErrRefreshTokenNotFound
	}
	t.RevokedAt = &at
	return nil
}

func (f *fakeRefreshStore) RevokeAllForUser(ctx context.Context, userID uint, at time.Time) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, t := range f.byJTI {
		if t.UserID == userID && t.RevokedAt == nil {
			cp := at
			t.RevokedAt = &cp
		}
	}
	return nil
}

func (f *fakeRefreshStore) PurgeExpired(ctx context.Context, before time.Time) (int64, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	var n int64
	for jti, t := range f.byJTI {
		if t.ExpiresAt.Before(before) {
			delete(f.byJTI, jti)
			n++
		}
	}
	return n, nil
}

func newTestService(t *testing.T) *Service {
	t.Helper()
	us := newFakeUserStore()
	rs := newFakeRefreshStore()
	hasher := NewHasher(testCost)
	signer := NewSigner(testSecret, 15*time.Minute, time.Hour)
	return New(us, rs, hasher, signer)
}

func TestService_Login_success(t *testing.T) {
	t.Parallel()
	svc := newTestService(t)
	ctx := context.Background()
	_, err := svc.CreateUser(ctx, CreateUserInput{
		Username: "alice", Password: "password123", Role: RoleOperator, Active: true,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}

	pair, u, err := svc.Login(ctx, "alice", "password123")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	if u.Username != "alice" || u.Role != RoleOperator {
		t.Errorf("user: %+v", u)
	}
	if pair.AccessToken == "" || pair.RefreshToken == "" {
		t.Errorf("empty tokens")
	}
}

func TestService_Login_wrongPassword(t *testing.T) {
	t.Parallel()
	svc := newTestService(t)
	ctx := context.Background()
	_, _ = svc.CreateUser(ctx, CreateUserInput{
		Username: "alice", Password: "password123", Role: RoleOperator, Active: true,
	})
	_, _, err := svc.Login(ctx, "alice", "wrongpass")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("err = %v, want ErrInvalidCredentials", err)
	}
}

func TestService_Login_unknownUser(t *testing.T) {
	t.Parallel()
	svc := newTestService(t)
	_, _, err := svc.Login(context.Background(), "ghost", "whatever1")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Errorf("err = %v, want ErrInvalidCredentials", err)
	}
}

func TestService_Login_inactiveUser(t *testing.T) {
	t.Parallel()
	svc := newTestService(t)
	ctx := context.Background()
	_, _ = svc.CreateUser(ctx, CreateUserInput{
		Username: "bob", Password: "password123", Role: RoleViewer, Active: false,
	})
	_, _, err := svc.Login(ctx, "bob", "password123")
	if !errors.Is(err, ErrUserInactive) {
		t.Errorf("err = %v, want ErrUserInactive", err)
	}
}

func TestService_Refresh_rotation(t *testing.T) {
	t.Parallel()
	svc := newTestService(t)
	ctx := context.Background()
	_, _ = svc.CreateUser(ctx, CreateUserInput{
		Username: "carol", Password: "password123", Role: RoleAdmin, Active: true,
	})
	pair, _, err := svc.Login(ctx, "carol", "password123")
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	newPair, _, err := svc.Refresh(ctx, pair.RefreshToken)
	if err != nil {
		t.Fatalf("refresh: %v", err)
	}
	if newPair.RefreshToken == pair.RefreshToken {
		t.Errorf("refresh token tidak ter-rotate")
	}
	// Token lama harus revoked: panggil refresh lagi pakai token lama → ErrRefreshRevoked.
	_, _, err = svc.Refresh(ctx, pair.RefreshToken)
	if !errors.Is(err, ErrRefreshRevoked) {
		t.Errorf("err = %v, want ErrRefreshRevoked", err)
	}
}

func TestService_Refresh_rejectsAccessToken(t *testing.T) {
	t.Parallel()
	svc := newTestService(t)
	ctx := context.Background()
	_, _ = svc.CreateUser(ctx, CreateUserInput{
		Username: "dave", Password: "password123", Role: RoleViewer, Active: true,
	})
	pair, _, _ := svc.Login(ctx, "dave", "password123")
	_, _, err := svc.Refresh(ctx, pair.AccessToken)
	if !errors.Is(err, ErrTokenWrongType) {
		t.Errorf("err = %v, want ErrTokenWrongType", err)
	}
}

func TestService_Logout_revokesRefresh(t *testing.T) {
	t.Parallel()
	svc := newTestService(t)
	ctx := context.Background()
	_, _ = svc.CreateUser(ctx, CreateUserInput{
		Username: "eve", Password: "password123", Role: RoleViewer, Active: true,
	})
	pair, _, _ := svc.Login(ctx, "eve", "password123")

	if err := svc.Logout(ctx, pair.RefreshToken); err != nil {
		t.Fatalf("logout: %v", err)
	}
	_, _, err := svc.Refresh(ctx, pair.RefreshToken)
	if !errors.Is(err, ErrRefreshRevoked) {
		t.Errorf("err = %v, want ErrRefreshRevoked after logout", err)
	}
}

func TestService_Logout_idempotent(t *testing.T) {
	t.Parallel()
	svc := newTestService(t)
	// Token garbage tidak bikin error.
	if err := svc.Logout(context.Background(), "not.a.jwt"); err != nil {
		t.Errorf("logout garbage err = %v, want nil", err)
	}
}

func TestService_CreateUser_duplicateUsername(t *testing.T) {
	t.Parallel()
	svc := newTestService(t)
	ctx := context.Background()
	_, err := svc.CreateUser(ctx, CreateUserInput{
		Username: "frank", Password: "password123", Role: RoleOperator, Active: true,
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	_, err = svc.CreateUser(ctx, CreateUserInput{
		Username: "frank", Password: "different1", Role: RoleViewer, Active: true,
	})
	if !errors.Is(err, ErrUserExists) {
		t.Errorf("err = %v, want ErrUserExists", err)
	}
}

func TestService_CreateUser_invalidRole(t *testing.T) {
	t.Parallel()
	svc := newTestService(t)
	_, err := svc.CreateUser(context.Background(), CreateUserInput{
		Username: "grace", Password: "password123", Role: "superuser", Active: true,
	})
	if !errors.Is(err, ErrRoleInvalid) {
		t.Errorf("err = %v, want ErrRoleInvalid", err)
	}
}

func TestService_UpdateUser_revokesTokensOnPasswordChange(t *testing.T) {
	t.Parallel()
	svc := newTestService(t)
	ctx := context.Background()
	u, _ := svc.CreateUser(ctx, CreateUserInput{
		Username: "henry", Password: "password123", Role: RoleOperator, Active: true,
	})
	pair, _, _ := svc.Login(ctx, "henry", "password123")

	newPass := "newpassword456"
	_, err := svc.UpdateUser(ctx, u.ID, UpdateUserInput{Password: &newPass})
	if err != nil {
		t.Fatalf("update: %v", err)
	}

	// Refresh token lama harus invalid.
	_, _, err = svc.Refresh(ctx, pair.RefreshToken)
	if !errors.Is(err, ErrRefreshRevoked) {
		t.Errorf("err = %v, want ErrRefreshRevoked", err)
	}
}

func TestService_DeleteUser_cascadeRevoke(t *testing.T) {
	t.Parallel()
	svc := newTestService(t)
	ctx := context.Background()
	u, _ := svc.CreateUser(ctx, CreateUserInput{
		Username: "ivan", Password: "password123", Role: RoleViewer, Active: true,
	})
	pair, _, _ := svc.Login(ctx, "ivan", "password123")
	if err := svc.DeleteUser(ctx, u.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	_, _, err := svc.Refresh(ctx, pair.RefreshToken)
	if err == nil {
		t.Errorf("expected error after user delete")
	}
}

func TestService_BootstrapAdmin_idempotent(t *testing.T) {
	t.Parallel()
	svc := newTestService(t)
	ctx := context.Background()
	if err := svc.BootstrapAdmin(ctx, "admin", "supersecret123"); err != nil {
		t.Fatalf("bootstrap 1: %v", err)
	}
	// Run kedua kali → tidak overwrite.
	if err := svc.BootstrapAdmin(ctx, "admin", "supersecret123"); err != nil {
		t.Fatalf("bootstrap 2: %v", err)
	}
	users, _ := svc.ListUsers(ctx)
	if len(users) != 1 {
		t.Errorf("user count = %d, want 1", len(users))
	}
}

func TestService_BootstrapAdmin_skipWhenEmpty(t *testing.T) {
	t.Parallel()
	svc := newTestService(t)
	if err := svc.BootstrapAdmin(context.Background(), "", ""); err != nil {
		t.Fatalf("bootstrap with empty creds should noop: %v", err)
	}
	users, _ := svc.ListUsers(context.Background())
	if len(users) != 0 {
		t.Errorf("expected zero users, got %d", len(users))
	}
}
