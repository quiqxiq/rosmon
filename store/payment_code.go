package store

import (
	"crypto/rand"
	"math/big"
)

// paymentCodeAlphabet — Crockford-ish base32 tanpa karakter ambigu (0/O/1/I/L/U)
// agar kode mudah dibaca/diketik manual oleh petugas.
const paymentCodeAlphabet = "23456789ABCDEFGHJKMNPQRSTVWXYZ"

const paymentCodeLen = 10

// NewPaymentCode menghasilkan kode pembayaran acak (crypto-random) ~10 char.
// Ruang ~30^10 ≈ 5.9e14 → tabrakan sangat kecil; unique index di DB tetap
// menjadi guard terakhir. Dipakai saat invoice dibuat (billing + registrasi)
// dan backfill di Migrate. Diletakkan di package store agar bisa dipakai
// migrate.go tanpa import service (hindari cycle store↔billing).
func NewPaymentCode() string {
	b := make([]byte, paymentCodeLen)
	max := big.NewInt(int64(len(paymentCodeAlphabet)))
	for i := range b {
		n, err := rand.Int(rand.Reader, max)
		if err != nil {
			b[i] = paymentCodeAlphabet[0]
			continue
		}
		b[i] = paymentCodeAlphabet[n.Int64()]
	}
	return string(b)
}
