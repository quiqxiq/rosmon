// Package whatsapp membungkus klien whatsmeow embedded. Sesi disimpan
// persisten di Postgres (sqlstore). Manager mengimplementasikan
// notification.Sender (lewat Send + Name) sehingga bisa di-inject ke
// service/notification tanpa import silang.
package whatsapp

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/sirupsen/logrus"
	"go.mau.fi/whatsmeow"
	waE2E "go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
)

// Deps adalah dependency Manager.
type Deps struct {
	// DB adalah koneksi Postgres (gunakan gorm db.DB()). sqlstore membuat
	// tabel whatsmeow_* di database yang sama.
	DB *sql.DB
	// CountryCode default untuk normalisasi nomor (mis. "62").
	CountryCode string
	Log         *logrus.Logger
}

// Manager mengelola lifecycle koneksi whatsmeow.
type Manager struct {
	db          *sql.DB
	countryCode string
	log         *logrus.Logger

	mu        sync.RWMutex
	client    *whatsmeow.Client
	currentQR string
}

func New(d Deps) *Manager {
	if d.Log == nil {
		d.Log = logrus.New()
	}
	if d.CountryCode == "" {
		d.CountryCode = "62"
	}
	return &Manager{db: d.DB, countryCode: d.CountryCode, log: d.Log}
}

// Start menyiapkan device store + client lalu connect kalau sudah ada sesi.
// Non-fatal: kegagalan koneksi tidak menghentikan server — notifikasi akan
// gagal (failed) dan di-retry; admin bisa login ulang via endpoint QR.
func (m *Manager) Start(ctx context.Context) error {
	if m.db == nil {
		m.log.Warn("whatsapp: DB nil — manager dinonaktifkan")
		return nil
	}
	container := sqlstore.NewWithDB(m.db, "postgres", waLog.Noop)
	if err := container.Upgrade(ctx); err != nil {
		return fmt.Errorf("whatsapp: upgrade store: %w", err)
	}
	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		return fmt.Errorf("whatsapp: get device: %w", err)
	}
	client := whatsmeow.NewClient(device, waLog.Noop)

	m.mu.Lock()
	m.client = client
	m.mu.Unlock()

	if client.Store.ID != nil {
		if err := client.Connect(); err != nil {
			m.log.WithError(err).Warn("whatsapp: connect sesi lama gagal")
		} else {
			m.log.WithField("jid", client.Store.ID.String()).Info("whatsapp: connected (sesi lama)")
		}
		return nil
	}
	m.log.Info("whatsapp: belum ada sesi — scan QR via GET /api/v1/whatsapp/qr untuk login")
	return nil
}

// Login memulai pairing baru: ambil QR channel (harus sebelum Connect),
// connect, lalu simpan QR terbaru. Return QR code pertama (data mentah —
// frontend yang render jadi gambar). Error kalau sudah login.
func (m *Manager) Login(_ context.Context) (string, error) {
	m.mu.RLock()
	client := m.client
	qr := m.currentQR
	m.mu.RUnlock()
	if client == nil {
		return "", fmt.Errorf("whatsapp: manager belum di-start")
	}
	if client.Store.ID != nil {
		return "", fmt.Errorf("whatsapp: sudah login")
	}
	if qr != "" {
		return qr, nil // pairing sudah berjalan, kembalikan QR terkini
	}

	// GetQRChannel WAJIB dipanggil sebelum Connect.
	qrChan, err := client.GetQRChannel(context.Background())
	if err != nil {
		return "", fmt.Errorf("whatsapp: qr channel: %w", err)
	}
	if err := client.Connect(); err != nil {
		return "", fmt.Errorf("whatsapp: connect: %w", err)
	}

	first := make(chan string, 1)
	go func() {
		for evt := range qrChan {
			switch evt.Event {
			case "code":
				m.mu.Lock()
				m.currentQR = evt.Code
				m.mu.Unlock()
				select {
				case first <- evt.Code:
				default:
				}
			case "success":
				m.mu.Lock()
				m.currentQR = ""
				m.mu.Unlock()
				m.log.Info("whatsapp: login berhasil")
			default:
				m.mu.Lock()
				m.currentQR = ""
				m.mu.Unlock()
				m.log.WithField("event", evt.Event).Info("whatsapp: qr event")
			}
		}
	}()

	select {
	case code := <-first:
		return code, nil
	case <-time.After(5 * time.Second):
		return "", fmt.Errorf("whatsapp: timeout menunggu QR")
	}
}

// Logout memutus tautan device & menghapus sesi lokal.
func (m *Manager) Logout(ctx context.Context) error {
	m.mu.RLock()
	client := m.client
	m.mu.RUnlock()
	if client == nil {
		return fmt.Errorf("whatsapp: manager belum di-start")
	}
	m.mu.Lock()
	m.currentQR = ""
	m.mu.Unlock()
	return client.Logout(ctx)
}

// Connected = terhubung ke websocket DAN terotentikasi.
func (m *Manager) Connected() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.client != nil && m.client.IsConnected() && m.client.IsLoggedIn()
}

// JID mengembalikan JID akun yang login (kosong kalau belum).
func (m *Manager) JID() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.client == nil || m.client.Store.ID == nil {
		return ""
	}
	return m.client.Store.ID.String()
}

// CurrentQR mengembalikan QR terkini (kosong kalau tidak ada pairing aktif).
func (m *Manager) CurrentQR() string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.currentQR
}

// Name memenuhi notification.Sender.
func (m *Manager) Name() string { return "whatsmeow" }

// Send mengirim pesan teks. Memenuhi notification.Sender. Error kalau belum
// connect/login supaya notification.Service menandainya failed (untuk retry).
func (m *Manager) Send(ctx context.Context, phone, message string) (string, error) {
	m.mu.RLock()
	client := m.client
	m.mu.RUnlock()
	if client == nil {
		return "", fmt.Errorf("whatsapp: manager belum di-start")
	}
	if !client.IsConnected() || !client.IsLoggedIn() {
		return "", fmt.Errorf("whatsapp: belum terhubung/login")
	}
	jid, err := m.toJID(phone)
	if err != nil {
		return "", err
	}
	resp, err := client.SendMessage(ctx, jid, &waE2E.Message{Conversation: proto.String(message)})
	if err != nil {
		return "", err
	}
	return resp.ID, nil
}

// toJID normalisasi nomor lokal → JID WhatsApp.
func (m *Manager) toJID(phone string) (types.JID, error) {
	n := normalizeNumber(phone, m.countryCode)
	if n == "" {
		return types.JID{}, fmt.Errorf("whatsapp: nomor tidak valid %q", phone)
	}
	return types.NewJID(n, types.DefaultUserServer), nil
}

// normalizeNumber mengubah nomor lokal jadi format internasional tanpa "+".
// "0812..." → "<cc>812..."; yang sudah berawalan cc atau internasional
// dibiarkan. Karakter non-digit dibuang.
func normalizeNumber(phone, cc string) string {
	var b strings.Builder
	for _, r := range phone {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	d := b.String()
	if d == "" {
		return ""
	}
	if strings.HasPrefix(d, "0") {
		return cc + d[1:]
	}
	return d
}
