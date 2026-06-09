// Command seed mengisi database dengan data development:
//   - 3 PPP billing profiles
//   - 3 Hotspot billing profiles (2 permanent + 1 voucher)
//   - 5 customer PPPoE + subscription
//   - 3 customer hotspot permanent + subscription
//   - 10 voucher hotspot
//
// Seeder bersifat idempotent — aman dijalankan berulang kali.
//
// Usage:
//
//	go run ./cmd/seed/                       # DB + langsung sync ke MikroTik (auto-pilih jika 1 device)
//	go run ./cmd/seed/ --device-id=2         # gunakan device ID tertentu
//	go run ./cmd/seed/ --direct-sync=false   # DB saja, biarkan outbox sync
//	go run ./cmd/seed/ --force               # re-generate voucher meski sudah ada
package main

import (
	"context"
	"encoding/hex"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/quiqxiq/rosmon/internal/config"
	"github.com/quiqxiq/rosmon/store"
	"github.com/sirupsen/logrus"
)

func main() {
	directSync := flag.Bool("direct-sync", true, "langsung sync PPP secret & hotspot user ke MikroTik")
	force := flag.Bool("force", false, "re-generate voucher meski .vouchers.json sudah ada")
	deviceID := flag.Uint("device-id", 0, "ID device MikroTik yang dipakai (0 = auto-pilih jika hanya 1 device terdaftar)")
	flag.Parse()

	log := logrus.New()
	log.SetFormatter(&logrus.TextFormatter{FullTimestamp: true})

	dotenvPath := os.Getenv("DOTENV_FILE")
	if dotenvPath == "" {
		dotenvPath = ".env"
	}
	if err := godotenv.Load(dotenvPath); err == nil {
		log.WithField("file", dotenvPath).Info("loaded .env")
	}

	// Set crypto key jika ada.
	if keyHex := os.Getenv("DEVICE_PASSWORD_KEY"); keyHex != "" {
		key, err := hex.DecodeString(keyHex)
		if err != nil || len(key) != 32 {
			log.Warn("DEVICE_PASSWORD_KEY tidak valid — password device disimpan plaintext")
		} else {
			if err := store.SetDeviceCryptoKey(key); err != nil {
				log.WithError(err).Fatal("invalid DEVICE_PASSWORD_KEY")
			}
		}
	}

	dbCfg := config.LoadDBFromEnv()
	db, err := store.Open(dbCfg.DSN())
	if err != nil {
		log.WithError(err).Fatal("gagal connect ke database")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	s := newSeeder(db, log, *deviceID)

	log.Info("=== Fase 1: DB seed ===")
	if err := s.seedDB(ctx); err != nil {
		log.WithError(err).Fatal("seed DB gagal")
	}

	if *directSync {
		log.Info("=== Fase 2: MikroTik direct sync ===")
		if err := s.seedMikroTik(ctx, *force); err != nil {
			log.WithError(err).Error("MikroTik sync gagal — data DB sudah tersimpan, outbox akan retry saat server aktif")
			fmt.Println("\n⚠  MikroTik tidak dapat dijangkau. Jalankan server agar outbox meng-sync otomatis.")
		}
	} else {
		log.Info("--direct-sync=false: skip MikroTik phase. Jalankan server untuk sync via outbox.")
	}

	log.Info("=== Seeder selesai ===")
	printSummary(s)
}

func printSummary(s *seeder) {
	fmt.Println()
	fmt.Println("────────────────────────────────────────")
	fmt.Println("  Rosmon Dev Seeder — Ringkasan")
	fmt.Println("────────────────────────────────────────")
	fmt.Printf("  PPP profiles       : %d dibuat / %d sudah ada\n", s.pppCreated, s.pppSkipped)
	fmt.Printf("  Hotspot profiles   : %d dibuat / %d sudah ada\n", s.hpCreated, s.hpSkipped)
	fmt.Printf("  Customers          : %d dibuat / %d sudah ada\n", s.custCreated, s.custSkipped)
	fmt.Printf("  Subscriptions      : %d dibuat / %d sudah ada\n", s.subCreated, s.subSkipped)
	fmt.Printf("  PPP secrets (MK)   : %d dibuat / %d sudah ada\n", s.secretCreated, s.secretSkipped)
	fmt.Printf("  Hotspot users (MK) : %d dibuat / %d sudah ada\n", s.hsUserCreated, s.hsUserSkipped)
	fmt.Printf("  Vouchers (MK)      : %d dibuat\n", s.voucherCount)
	if s.voucherFile != "" {
		fmt.Printf("  Voucher file       : %s\n", s.voucherFile)
	}
	fmt.Println("────────────────────────────────────────")
}
