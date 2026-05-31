package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
)

func main() {
	fmt.Println("==================================================")
	fmt.Println("     📊 INFLUXDB3 CROSS-PLATFORM TOKEN GENERATOR ")
	fmt.Println("==================================================")

	// 1. Temukan container influxdb3 yang berjalan
	containerName := "rosmon-influx"
	if checkRunning(containerName + "-dev") {
		containerName = containerName + "-dev"
	} else if !checkRunning(containerName) {
		// Coba cari container lain yang mengandung kata influx
		found, err := findRunningInfluxContainer()
		if err == nil && found != "" {
			containerName = found
		} else {
			fmt.Printf("❌ ERROR: Container InfluxDB tidak ditemukan atau tidak sedang berjalan.\n")
			fmt.Printf("Silakan jalankan infrastruktur terlebih dahulu dengan:\n")
			fmt.Printf("  make up-dev   (untuk Development)\n")
			fmt.Printf("  atau\n")
			fmt.Printf("  make up       (untuk Production)\n")
			os.Exit(1)
		}
	}

	fmt.Printf("👉 Menggunakan container: %s\n", containerName)
	fmt.Println("👉 Membuat token admin baru untuk InfluxDB3...")

	// 2. Jalankan perintah untuk membuat token
	cmd := exec.Command("docker", "exec", containerName, "influxdb3", "create", "token", "--admin", "--host", "http://localhost:8181", "--format", "json")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	outputStr := stdout.String()
	stderrStr := stderr.String()

	var token string
	if err != nil {
		fmt.Printf("⚠️ Peringatan saat menjalankan CLI influxdb3: %v\n", err)
	}

	// 3. Parse JSON
	type TokenResponse struct {
		Token         string `json:"token"`
		UnhashedToken string `json:"unhashed_token"`
	}

	var resp TokenResponse
	if err := json.Unmarshal([]byte(outputStr), &resp); err == nil {
		if resp.Token != "" {
			token = resp.Token
		} else {
			token = resp.UnhashedToken
		}
	}

	// Fallback regex jika JSON parsing gagal
	if token == "" {
		re := regexp.MustCompile(`apiv3_[A-Za-z0-9_-]+`)
		token = re.FindString(outputStr)
		if token == "" {
			token = re.FindString(stderrStr)
		}
	}

	if token == "" {
		fmt.Printf("❌ ERROR: Gagal mengekstrak token dari CLI InfluxDB.\n")
		fmt.Printf("Stdout: %s\n", outputStr)
		fmt.Printf("Stderr: %s\n", stderrStr)
		os.Exit(1)
	}

	// 4. Update file .env
	envPath := ".env"
	if _, err := os.Stat(envPath); os.IsNotExist(err) {
		// Jika .env belum ada, copy dari .env.example
		if err := copyFile(".env.example", ".env"); err != nil {
			fmt.Printf("❌ ERROR: Gagal membuat .env: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("✓ Membuat .env baru dari .env.example")
	}

	err = updateEnvFile(envPath, token)
	if err != nil {
		fmt.Printf("❌ ERROR: Gagal memperbarui file %s: %v\n", envPath, err)
		os.Exit(1)
	}

	fmt.Println("\n==================================================")
	fmt.Println("🎉 SUKSES!")
	fmt.Printf("✓ Token InfluxDB berhasil didapatkan!\n")
	fmt.Printf("✓ Token: %s\n", token)
	fmt.Printf("✓ Konfigurasi disimpan ke %s (INFLUX_TOKEN dan disetel INFLUX_ENABLED=true)\n", envPath)
	fmt.Println("==================================================")
}

func checkRunning(name string) bool {
	cmd := exec.Command("docker", "inspect", "-f", "{{.State.Running}}", name)
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return false
	}
	return strings.TrimSpace(out.String()) == "true"
}

func findRunningInfluxContainer() (string, error) {
	cmd := exec.Command("docker", "ps", "--filter", "status=running", "--format", "{{.Names}}")
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err != nil {
		return "", err
	}
	lines := strings.Split(out.String(), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.Contains(line, "influx") {
			return line, nil
		}
	}
	return "", nil
}

func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	return os.WriteFile(dst, data, 0644)
}

func updateEnvFile(filepath string, token string) error {
	content, err := os.ReadFile(filepath)
	if err != nil {
		return err
	}

	lines := strings.Split(string(content), "\n")
	foundToken := false
	foundEnabled := false

	tokenRegex := regexp.MustCompile(`^INFLUX_TOKEN\s*=.*`)
	enabledRegex := regexp.MustCompile(`^INFLUX_ENABLED\s*=.*`)

	for i, line := range lines {
		if tokenRegex.MatchString(line) {
			lines[i] = fmt.Sprintf("INFLUX_TOKEN=%s", token)
			foundToken = true
		} else if enabledRegex.MatchString(line) {
			lines[i] = "INFLUX_ENABLED=true"
			foundEnabled = true
		}
	}

	result := strings.Join(lines, "\n")
	if !foundToken {
		result += fmt.Sprintf("\nINFLUX_TOKEN=%s", token)
	}
	if !foundEnabled {
		result += "\nINFLUX_ENABLED=true"
	}

	// Normalisasi baris kosong ganda yang mungkin terjadi akibat string append
	result = strings.TrimSpace(result) + "\n"

	return os.WriteFile(filepath, []byte(result), 0644)
}
