package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
)

func main() {
	fmt.Println("==================================================")
	fmt.Println("      🚀 ROSMON CROSS-PLATFORM SYSTEM SETUP      ")
	fmt.Println("==================================================")

	// 1. Copy .env.example to .env
	envPath := ".env"
	if _, err := os.Stat(envPath); os.IsNotExist(err) {
		fmt.Println("👉 File .env tidak ditemukan. Menyalin dari .env.example...")
		if err := copyFile(".env.example", ".env"); err != nil {
			fmt.Printf("❌ ERROR: Gagal menyalin .env.example: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("✓ File .env berhasil dibuat.")
	} else {
		fmt.Println("✓ File .env sudah ada.")
	}

	// 2. Generate secure random secrets inside .env
	if err := secureSecrets(envPath); err != nil {
		fmt.Printf("❌ ERROR: Gagal mengamankan secret di .env: %v\n", err)
		os.Exit(1)
	}

	// 3. Copy web/.env.example to web/.env
	webEnvPath := filepath.Join("web", ".env")
	if _, err := os.Stat(webEnvPath); os.IsNotExist(err) {
		fmt.Println("👉 File web/.env tidak ditemukan. Menyalin dari web/.env.example...")
		if err := copyFile(filepath.Join("web", ".env.example"), webEnvPath); err != nil {
			fmt.Printf("❌ ERROR: Gagal menyalin web/.env.example: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("✓ File web/.env berhasil dibuat.")
	} else {
		fmt.Println("✓ File web/.env sudah ada.")
	}

	// 4. Install Go dependencies
	fmt.Println("👉 Mendownload dependensi backend Go...")
	goCmd := exec.Command("go", "mod", "download")
	goCmd.Stdout = os.Stdout
	goCmd.Stderr = os.Stderr
	if err := goCmd.Run(); err != nil {
		fmt.Printf("⚠️ Peringatan: Gagal mendownload go mod (mungkin offline): %v\n", err)
	} else {
		fmt.Println("✓ Dependensi backend Go berhasil disiapkan.")
	}

	// 5. Install web dependencies (pnpm)
	fmt.Println("👉 Memeriksa pnpm untuk instalasi frontend...")
	if hasPnpm() {
		fmt.Println("👉 Menjalankan pnpm install di folder web...")
		pnpmCmd := exec.Command("pnpm", "install")
		pnpmCmd.Dir = "web"
		pnpmCmd.Stdout = os.Stdout
		pnpmCmd.Stderr = os.Stderr
		if err := pnpmCmd.Run(); err != nil {
			fmt.Printf("❌ ERROR: Gagal menjalankan pnpm install: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("✓ Dependensi frontend React berhasil diinstal.")
	} else {
		fmt.Println("⚠️ Peringatan: 'pnpm' tidak terinstal. Silakan jalankan 'npm install -g pnpm' secara global, lalu masuk ke folder 'web' dan jalankan 'pnpm install'.")
	}

	fmt.Println("\n==================================================")
	fmt.Println("🎉 SETUP SELESAI!")
	fmt.Println("Jalankan 'make up-dev' untuk memulai container dev,")
	fmt.Println("atau 'make dev' untuk menjalankan local dev servers.")
	fmt.Println("==================================================")
}

func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0644)
}

func secureSecrets(filepath string) error {
	content, err := os.ReadFile(filepath)
	if err != nil {
		return err
	}

	lines := strings.Split(string(content), "\n")
	updated := false

	jwtPlaceholder := "replace-with-32-char-or-longer-secret-string-here"
	jwtRegex := regexp.MustCompile(`^JWT_SECRET\s*=.*`)
	cryptoRegex := regexp.MustCompile(`^DEVICE_PASSWORD_KEY\s*=.*`)

	hasJWT := false
	hasCrypto := false

	for i, line := range lines {
		// Ubah JWT_SECRET jika masih bernilai placeholder default
		if jwtRegex.MatchString(line) {
			hasJWT = true
			val := strings.TrimSpace(strings.Split(line, "=")[1])
			if strings.Contains(line, jwtPlaceholder) || val == "" {
				secret, _ := generateRandomHex(32)
				lines[i] = fmt.Sprintf("JWT_SECRET=%s", secret)
				updated = true
				fmt.Println("🔑 Menghasilkan JWT_SECRET baru yang aman.")
			}
		}

		// Ubah DEVICE_PASSWORD_KEY jika masih kosong
		if cryptoRegex.MatchString(line) {
			hasCrypto = true
			val := strings.TrimSpace(strings.Split(line, "=")[1])
			if val == "" {
				secret, _ := generateRandomHex(32)
				lines[i] = fmt.Sprintf("DEVICE_PASSWORD_KEY=%s", secret)
				updated = true
				fmt.Println("🔑 Menghasilkan DEVICE_PASSWORD_KEY baru untuk enkripsi password router.")
			}
		}
	}

	// Jika field tidak ditemukan sama sekali di .env pre-existing, append mereka!
	if !hasJWT {
		secret, _ := generateRandomHex(32)
		lines = append(lines, fmt.Sprintf("\nJWT_SECRET=%s", secret))
		updated = true
		fmt.Println("🔑 Menambahkan JWT_SECRET acak baru yang aman.")
	}
	if !hasCrypto {
		secret, _ := generateRandomHex(32)
		lines = append(lines, fmt.Sprintf("\nDEVICE_PASSWORD_KEY=%s", secret))
		updated = true
		fmt.Println("🔑 Menambahkan DEVICE_PASSWORD_KEY acak baru.")
	}

	if updated {
		return os.WriteFile(filepath, []byte(strings.Join(lines, "\n")), 0644)
	}
	return nil
}

func generateRandomHex(n int) (string, error) {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

func hasPnpm() bool {
	_, err := exec.LookPath("pnpm")
	return err == nil
}
