// Package portal berisi service untuk Customer Portal (self-service pelanggan)
// — scope auth TERPISAH dari staff. Login pakai nomor HP + password.
package portal

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/quiqxiq/rosmon/service/auth"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
)

// Deps untuk CustomerAuth.
type Deps struct {
	Customers store.CustomerStore
	Hasher    *auth.Hasher
	Signer    *auth.Signer
	NowFunc   func() time.Time
}

// CustomerAuth menangani login & manajemen password portal pelanggan.
type CustomerAuth struct{ d Deps }

func New(d Deps) *CustomerAuth {
	if d.NowFunc == nil {
		d.NowFunc = time.Now
	}
	return &CustomerAuth{d: d}
}

// Login memverifikasi nomor HP + password lalu menerbitkan customer access
// token. Semua kegagalan (HP tak ada, belum punya password, password salah)
// di-map ke ErrInvalidCredentials agar tidak membocorkan keberadaan akun.
func (a *CustomerAuth) Login(ctx context.Context, phone, password string) (string, model.Customer, error) {
	phone = strings.TrimSpace(phone)
	cust, err := a.d.Customers.GetByPhone(ctx, phone)
	if err != nil {
		if errors.Is(err, store.ErrCustomerNotFound) {
			return "", model.Customer{}, auth.ErrInvalidCredentials
		}
		return "", model.Customer{}, err
	}
	if cust.PortalPasswordHash == "" {
		return "", model.Customer{}, auth.ErrInvalidCredentials
	}
	if err := a.d.Hasher.Verify(cust.PortalPasswordHash, password); err != nil {
		return "", model.Customer{}, auth.ErrInvalidCredentials
	}
	token, err := a.d.Signer.SignCustomerAccess(cust.ID, cust.Phone)
	if err != nil {
		return "", model.Customer{}, err
	}
	return token, cust, nil
}

// SetPassword dipakai admin untuk meng-onboard / reset password portal
// pelanggan. Password minimal 8 char (ErrWeakPassword dari Hasher.Hash).
func (a *CustomerAuth) SetPassword(ctx context.Context, customerID uint, newPassword string) error {
	cust, err := a.d.Customers.Get(ctx, customerID)
	if err != nil {
		return err
	}
	hash, err := a.d.Hasher.Hash(newPassword)
	if err != nil {
		return err
	}
	cust.PortalPasswordHash = hash
	return a.d.Customers.Update(ctx, &cust)
}

// ChangePassword dipakai pelanggan mengganti passwordnya sendiri.
func (a *CustomerAuth) ChangePassword(ctx context.Context, customerID uint, oldPassword, newPassword string) error {
	cust, err := a.d.Customers.Get(ctx, customerID)
	if err != nil {
		return err
	}
	if cust.PortalPasswordHash == "" {
		return auth.ErrInvalidCredentials
	}
	if err := a.d.Hasher.Verify(cust.PortalPasswordHash, oldPassword); err != nil {
		return auth.ErrInvalidCredentials
	}
	hash, err := a.d.Hasher.Hash(newPassword)
	if err != nil {
		return err
	}
	cust.PortalPasswordHash = hash
	return a.d.Customers.Update(ctx, &cust)
}
