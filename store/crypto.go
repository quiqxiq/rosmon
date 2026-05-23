package store

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
)

// deviceCryptoKey adalah key AES-256 untuk enkripsi password device.
// Harus di-set via SetDeviceCryptoKey sebelum store pertama kali dipakai.
// Nil = enkripsi dinonaktifkan (dev mode / backward compat).
var deviceCryptoKey []byte

// SetDeviceCryptoKey menerima raw 32-byte key. Dipanggil dari main.go saat
// startup jika DEVICE_PASSWORD_KEY diset.
func SetDeviceCryptoKey(key []byte) error {
	if len(key) != 32 {
		return fmt.Errorf("store: device crypto key harus 32 byte, got %d", len(key))
	}
	deviceCryptoKey = key
	return nil
}

// encryptDevicePassword mengenkripsi plaintext password menggunakan AES-256-GCM.
// Output: hex-encoded "nonce(12B) || ciphertext".
// Jika key tidak di-set, return plaintext apa adanya (backward compat / dev mode).
func encryptDevicePassword(plaintext string) (string, error) {
	if len(deviceCryptoKey) == 0 {
		return plaintext, nil
	}

	block, err := aes.NewCipher(deviceCryptoKey)
	if err != nil {
		return "", fmt.Errorf("store: aes cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("store: gcm: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("store: generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return hex.EncodeToString(ciphertext), nil
}

// decryptDevicePassword mendekripsi hex-encoded ciphertext dari encryptDevicePassword.
// Jika key tidak di-set, return input apa adanya (backward compat / dev mode).
// Jika decode hex gagal (artinya value adalah plaintext legacy), return input apa adanya
// — ini memungkinkan migrasi gradual tanpa downtime.
func decryptDevicePassword(encoded string) (string, error) {
	if len(deviceCryptoKey) == 0 {
		return encoded, nil
	}

	data, err := hex.DecodeString(encoded)
	if err != nil {
		// Bukan hex → kemungkinan plaintext legacy sebelum enkripsi diaktifkan.
		// Return apa adanya supaya devmgr masih bisa connect.
		return encoded, nil
	}

	block, err := aes.NewCipher(deviceCryptoKey)
	if err != nil {
		return "", fmt.Errorf("store: aes cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("store: gcm: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", errors.New("store: ciphertext terlalu pendek")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		// Decrypt gagal → mungkin plaintext legacy, return apa adanya.
		return encoded, nil
	}
	return string(plaintext), nil
}
