// Package portal berisi service untuk Customer Portal (self-service pelanggan)
// — scope auth TERPISAH dari staff. Login pakai nomor HP + password.
package portal

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"errors"
	"math/big"
	"strings"
	"time"

	"github.com/quiqxiq/rosmon/service/auth"
	"github.com/quiqxiq/rosmon/store"
	"github.com/quiqxiq/rosmon/store/model"
)

// minPortalPasswordLen — panjang minimum password portal. Dulu dijaga oleh
// Hasher.Hash (bcrypt); kini password disimpan reversible sehingga validasi
// dilakukan eksplisit di service.
const minPortalPasswordLen = 8

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
	if cust.PortalPassword == "" {
		return "", model.Customer{}, auth.ErrInvalidCredentials
	}
	// PortalPassword sudah didekripsi oleh store. Bandingkan constant-time.
	if subtle.ConstantTimeCompare([]byte(cust.PortalPassword), []byte(password)) != 1 {
		return "", model.Customer{}, auth.ErrInvalidCredentials
	}
	token, err := a.d.Signer.SignCustomerAccess(cust.ID, cust.Phone)
	if err != nil {
		return "", model.Customer{}, err
	}
	return token, cust, nil
}

// SetPassword dipakai admin untuk meng-onboard / reset password portal
// pelanggan. Password minimal minPortalPasswordLen char (ErrWeakPassword).
func (a *CustomerAuth) SetPassword(ctx context.Context, customerID uint, newPassword string) error {
	if len(newPassword) < minPortalPasswordLen {
		return auth.ErrWeakPassword
	}
	cust, err := a.d.Customers.Get(ctx, customerID)
	if err != nil {
		return err
	}
	cust.PortalPassword = newPassword
	return a.d.Customers.Update(ctx, &cust)
}

// RevealPassword mengembalikan password portal plaintext pelanggan. HANYA
// boleh dipanggil dari endpoint ber-RequireRole(admin,operator). Kosong =
// pelanggan belum punya password portal.
func (a *CustomerAuth) RevealPassword(ctx context.Context, customerID uint) (string, error) {
	cust, err := a.d.Customers.Get(ctx, customerID)
	if err != nil {
		return "", err
	}
	return cust.PortalPassword, nil
}

// Charset untuk password portal yang di-generate otomatis. Human-readable:
// huruf + angka tanpa karakter ambigu (0/O, 1/I/l) agar mudah diketik ulang
// pelanggan dari pesan WhatsApp.
const (
	portalPwLetters = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	portalPwSymbols = "@#$%&*"
	portalPwLen     = 10
)

// GenerateAndSetPassword membuat password portal acak (human-readable),
// menyimpannya (encrypted via store) ke customer.PortalPassword, lalu mengembalikan
// password plain untuk dikirim sekali lewat notifikasi. Caller TIDAK boleh
// menyimpan/men-log nilai plain ini. Memakai crypto/rand.
func (a *CustomerAuth) GenerateAndSetPassword(ctx context.Context, customerID uint) (string, error) {
	cust, err := a.d.Customers.Get(ctx, customerID)
	if err != nil {
		return "", err
	}
	plain, err := generatePortalPassword()
	if err != nil {
		return "", err
	}
	cust.PortalPassword = plain
	if err := a.d.Customers.Update(ctx, &cust); err != nil {
		return "", err
	}
	return plain, nil
}

// generatePortalPassword menghasilkan string portalPwLen char: minimal 1 simbol,
// sisanya huruf/angka non-ambigu, lalu di-acak posisinya. Semua keacakan dari
// crypto/rand.
func generatePortalPassword() (string, error) {
	out := make([]byte, 0, portalPwLen)
	// 1 simbol wajib.
	sym, err := randByte(portalPwSymbols)
	if err != nil {
		return "", err
	}
	out = append(out, sym)
	for len(out) < portalPwLen {
		ch, err := randByte(portalPwLetters)
		if err != nil {
			return "", err
		}
		out = append(out, ch)
	}
	// Shuffle agar simbol tidak selalu di depan (Fisher-Yates dgn crypto/rand).
	for i := len(out) - 1; i > 0; i-- {
		jBig, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return "", err
		}
		j := jBig.Int64()
		out[i], out[j] = out[j], out[i]
	}
	return string(out), nil
}

func randByte(charset string) (byte, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(int64(len(charset))))
	if err != nil {
		return 0, err
	}
	return charset[n.Int64()], nil
}

// ChangePassword dipakai pelanggan mengganti passwordnya sendiri.
func (a *CustomerAuth) ChangePassword(ctx context.Context, customerID uint, oldPassword, newPassword string) error {
	if len(newPassword) < minPortalPasswordLen {
		return auth.ErrWeakPassword
	}
	cust, err := a.d.Customers.Get(ctx, customerID)
	if err != nil {
		return err
	}
	if cust.PortalPassword == "" {
		return auth.ErrInvalidCredentials
	}
	// PortalPassword sudah didekripsi oleh store. Bandingkan constant-time.
	if subtle.ConstantTimeCompare([]byte(cust.PortalPassword), []byte(oldPassword)) != 1 {
		return auth.ErrInvalidCredentials
	}
	cust.PortalPassword = newPassword
	return a.d.Customers.Update(ctx, &cust)
}
