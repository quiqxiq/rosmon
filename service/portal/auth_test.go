package portal

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/quiqxiq/rosmon/service/auth"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
)

// fakeCustomerStore — in-memory store.CustomerStore untuk test.
type fakeCustomerStore struct {
	rows map[uint]model.Customer
	seq  uint
}

func newFakeCustomerStore() *fakeCustomerStore {
	return &fakeCustomerStore{rows: map[uint]model.Customer{}}
}

func (f *fakeCustomerStore) List(context.Context, store.CustomerListFilter) ([]model.Customer, error) {
	out := make([]model.Customer, 0, len(f.rows))
	for _, c := range f.rows {
		out = append(out, c)
	}
	return out, nil
}
func (f *fakeCustomerStore) Get(_ context.Context, id uint) (model.Customer, error) {
	c, ok := f.rows[id]
	if !ok {
		return model.Customer{}, store.ErrCustomerNotFound
	}
	return c, nil
}
func (f *fakeCustomerStore) GetByPhone(_ context.Context, phone string) (model.Customer, error) {
	for _, c := range f.rows {
		if c.Phone == phone {
			return c, nil
		}
	}
	return model.Customer{}, store.ErrCustomerNotFound
}
func (f *fakeCustomerStore) Create(_ context.Context, c *model.Customer) error {
	f.seq++
	c.ID = f.seq
	f.rows[c.ID] = *c
	return nil
}
func (f *fakeCustomerStore) Update(_ context.Context, c *model.Customer) error {
	if _, ok := f.rows[c.ID]; !ok {
		return store.ErrCustomerNotFound
	}
	f.rows[c.ID] = *c
	return nil
}
func (f *fakeCustomerStore) Delete(_ context.Context, id uint) error {
	delete(f.rows, id)
	return nil
}
func (f *fakeCustomerStore) BatchDelete(_ context.Context, ids []uint) (int64, error) {
	var n int64
	for _, id := range ids {
		if _, ok := f.rows[id]; ok {
			delete(f.rows, id)
			n++
		}
	}
	return n, nil
}

var _ store.CustomerStore = (*fakeCustomerStore)(nil)

func setup(t *testing.T) (*CustomerAuth, *fakeCustomerStore) {
	t.Helper()
	cs := newFakeCustomerStore()
	a := New(Deps{
		Customers: cs,
		Hasher:    auth.NewHasher(4), // fast for test
		Signer:    auth.NewSigner("0123456789abcdef0123456789abcdef", 0, 0),
	})
	return a, cs
}

func seedCustomer(t *testing.T, a *CustomerAuth, cs *fakeCustomerStore, phone, password string) uint {
	t.Helper()
	c := &model.Customer{FullName: "Pak Budi", Phone: phone, Status: "aktif"}
	if err := cs.Create(context.Background(), c); err != nil {
		t.Fatalf("create: %v", err)
	}
	if password != "" {
		if err := a.SetPassword(context.Background(), c.ID, password); err != nil {
			t.Fatalf("set password: %v", err)
		}
	}
	return c.ID
}

func TestLogin_OK(t *testing.T) {
	a, cs := setup(t)
	seedCustomer(t, a, cs, "0811", "supersecret")

	tok, cust, err := a.Login(context.Background(), "0811", "supersecret")
	if err != nil {
		t.Fatalf("login err = %v", err)
	}
	if tok == "" {
		t.Error("empty token")
	}
	if cust.Phone != "0811" {
		t.Errorf("customer phone = %q", cust.Phone)
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	a, cs := setup(t)
	seedCustomer(t, a, cs, "0811", "supersecret")
	_, _, err := a.Login(context.Background(), "0811", "wrongpass1")
	if !errors.Is(err, auth.ErrInvalidCredentials) {
		t.Errorf("err = %v, want ErrInvalidCredentials", err)
	}
}

func TestLogin_UnknownPhone(t *testing.T) {
	a, _ := setup(t)
	_, _, err := a.Login(context.Background(), "0899", "whatever1")
	if !errors.Is(err, auth.ErrInvalidCredentials) {
		t.Errorf("err = %v, want ErrInvalidCredentials", err)
	}
}

func TestLogin_NoPasswordSet(t *testing.T) {
	a, cs := setup(t)
	seedCustomer(t, a, cs, "0811", "") // no portal password
	_, _, err := a.Login(context.Background(), "0811", "anything1")
	if !errors.Is(err, auth.ErrInvalidCredentials) {
		t.Errorf("err = %v, want ErrInvalidCredentials", err)
	}
}

func TestChangePassword(t *testing.T) {
	a, cs := setup(t)
	id := seedCustomer(t, a, cs, "0811", "oldpassword")

	if err := a.ChangePassword(context.Background(), id, "oldpassword", "newpassword"); err != nil {
		t.Fatalf("change password err = %v", err)
	}
	// New password works.
	if _, _, err := a.Login(context.Background(), "0811", "newpassword"); err != nil {
		t.Errorf("login with new password failed: %v", err)
	}
	// Old password fails.
	if _, _, err := a.Login(context.Background(), "0811", "oldpassword"); !errors.Is(err, auth.ErrInvalidCredentials) {
		t.Errorf("old password still works? err = %v", err)
	}
}

func TestGenerateAndSetPassword(t *testing.T) {
	a, cs := setup(t)
	id := seedCustomer(t, a, cs, "0811", "") // belum punya password portal

	plain, err := a.GenerateAndSetPassword(context.Background(), id)
	if err != nil {
		t.Fatalf("generate err = %v", err)
	}

	// Panjang & karakter.
	if len(plain) != portalPwLen {
		t.Errorf("len = %d, want %d (plain=%q)", len(plain), portalPwLen, plain)
	}
	const ambiguous = "0O1Il"
	if strings.ContainsAny(plain, ambiguous) {
		t.Errorf("password mengandung karakter ambigu: %q", plain)
	}
	if !strings.ContainsAny(plain, portalPwSymbols) {
		t.Errorf("password tidak mengandung simbol: %q", plain)
	}

	// Password tersimpan & plain bisa dipakai login. Reveal mengembalikan nilai yang sama.
	revealed, err := a.RevealPassword(context.Background(), id)
	if err != nil {
		t.Fatalf("reveal err = %v", err)
	}
	if revealed != plain {
		t.Errorf("reveal = %q, want %q", revealed, plain)
	}
	if _, _, err := a.Login(context.Background(), "0811", plain); err != nil {
		t.Errorf("login dengan password generate gagal: %v", err)
	}

	// Dua pemanggilan menghasilkan password berbeda.
	plain2, err := a.GenerateAndSetPassword(context.Background(), id)
	if err != nil {
		t.Fatalf("generate kedua err = %v", err)
	}
	if plain == plain2 {
		t.Error("dua generate menghasilkan password yang sama")
	}
}

func TestGenerateAndSetPassword_UnknownCustomer(t *testing.T) {
	a, _ := setup(t)
	if _, err := a.GenerateAndSetPassword(context.Background(), 999); !errors.Is(err, store.ErrCustomerNotFound) {
		t.Errorf("err = %v, want ErrCustomerNotFound", err)
	}
}

func TestChangePassword_WrongOld(t *testing.T) {
	a, cs := setup(t)
	id := seedCustomer(t, a, cs, "0811", "oldpassword")
	err := a.ChangePassword(context.Background(), id, "wrongold1", "newpassword")
	if !errors.Is(err, auth.ErrInvalidCredentials) {
		t.Errorf("err = %v, want ErrInvalidCredentials", err)
	}
}
