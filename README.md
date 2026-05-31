# rosmon

**rosmon** adalah sistem manajemen ISP / RT-RW Net berbasis MikroTik — satu binary Go (REST API + SSE + background jobs) di atas library [`roslib`](../), plus dashboard React (`web/`). Mengelola pelanggan, langganan PPPoE & hotspot, penagihan + isolir otomatis, notifikasi WhatsApp, dan registrasi pemasangan. Multi-router, JWT auth, metrics InfluxDB.

> Visi & rencana pengembangan: **[goal.md](goal.md)** · **[roadmap.md](roadmap.md)**.
> Berawal dari reimplementasi RouterOS command & script milik [mikhmonv3](https://github.com/laksa19/mikhmonv3), kini berkembang jadi platform manajemen ISP.

## Status

**MikroTik / infra layer** (fondasi):

| Layer | Status | Test |
|---|---|---|
| `domain/`, `internal/rosfmt/`, `internal/tcpmock/` | ✅ | unit / self-test |
| `mikrotik/` (system, hotspot, ppp, network, syslog) | ✅ | integration (live router) |
| `scripts/` (onlogin, onevent, transaction, quickprint) | ✅ | unit (golden file) |
| `workflows/` (cascade) | ✅ | integration |
| `api/` (gin REST + SSE + JWT auth + webhook + rate limit) | ✅ | unit + live smoke |
| `cmd/server/` (entry point, multi-router, expiry, metrics) | ✅ | manual |

**Business layer** (manajemen ISP):

| Area | Status | Test |
|---|---|---|
| `store/` (GORM model + store: customer, subscription, invoice, payment, registration, audit, dst) | ✅ | unit + integration (testcontainers PG) |
| `service/billing` (generate invoice), `service/notification` (+ whatsapp), `service/audit` | ✅ | unit + integration |
| `job/` (outbox sync, billing_cron 07:00, suspension_check 09:00, notif_retry 5m) | ✅ | integration |
| Notifikasi **WhatsApp** (whatsmeow embedded, login via QR) | ✅ | manual |
| Registrasi pemasangan (publik + admin) | ✅ | unit + integration |
| Customer portal (backend + frontend) + Landing page | ✅ | unit + integration |
| Payment gateway (Fase 4) | ⬜ | (roadmap) |

Refactor besar (Mei 2026): paket `mikrotik/` di-thin-out — sekarang langsung di atas `*roslib.Device` (bukan `CommandRunner` boundary). Akibatnya muncul method khusus per resource untuk:

- **Streaming**: `hotspot.ActiveStream`, `ppp.ActiveStream`, `syslog.LogStream`, `network.InterfaceTrafficStream`, `network.InterfaceStatsStream`, `network.QueueStatsStream` — wrap `dev.Path(...).Print().Follow/FollowOnly/Interval.Stream()` + inherent streaming.
- **Polling**: `system.MonitorResource`, `system.MonitorScheduler`, `hotspot.MonitorActiveCount`, `hotspot.MonitorUserCount` — wrap `dev.RegisterPoll` (atau goroutine ticker untuk count-only yang hanya emit !done).
- **Cache**: `hotspot.ProfileListCached`, `hotspot.ServerListCached`, `network.PoolListCached`, `system.IdentityCached` — wrap `Print().ExecCached(ctx, ttl)`.

Mock `fake.Runner` dihapus — sub-paket terlalu tipis untuk unit-test (logic ada di `domain/` dan `scripts/` yang sudah pure). Test bergeser ke integration test (build tag `integration`).

## Business Layer (Manajemen ISP)

Di atas layer MikroTik, rosmon menambahkan bisnis ISP penuh:

- **Pelanggan & langganan** — CRUD customer + subscription PPPoE/hotspot dengan lifecycle `pending_install → active → isolir → suspended → terminated`. Mutasi yang menyentuh router pakai **DB-first + outbox**: tulis DB dulu, sync ke MikroTik di background (`job/outbox.go`, `FOR UPDATE SKIP LOCKED`) — tetap konsisten walau router offline.
- **Penagihan otomatis** — `job/billing_cron` (07:00) generate invoice anniversary per subscription (idempotent), `job/suspension_check` (09:00) tandai overdue → isolir → hard-suspend sesuai ambang di `system_settings`. Pembayaran manual (transfer/cash) + konfirmasi admin.
- **Notifikasi WhatsApp** — embedded **whatsmeow** (tanpa gateway HTTP eksternal), login via QR oleh admin (`GET /api/v1/whatsapp/qr`). Template pesan dapat diedit (`message_templates`), tiap kiriman tercatat (`notification_logs`) + retry (`job/notif_retry`). Semua notifikasi lewat `service/notification` saja.
- **Registrasi pemasangan** — calon pelanggan submit dari form publik (`POST /api/public/registrations`) → antrian admin (approve/reject/assign) → operator complete-install → subscription + invoice pertama + notifikasi otomatis.
- **Audit log** — tiap aksi ubah-status entitas utama dicatat di `audit_logs`.

Tiga zone route auth: **publik** (registrasi, landing page, paket), **staff JWT** (admin > operator > viewer), dan **customer** (portal pelanggan — JWT scope `customer_access` terpisah, login nomor HP + password, portal web di `web/src/features/customer-portal/`). Inventory endpoint + OpenAPI: [docs/API.md](docs/API.md); spec interaktif di `/docs`.

## Quickstart

Sistem ini mendukung setup lokal manual maupun full-stack menggunakan Docker secara cross-platform (Windows, macOS, Linux).

### 1. Setup Awal & Dependensi
Jalankan perintah berikut untuk menyalin file konfigurasi `.env`, men-generate secret keys acak yang aman secara otomatis, serta menyiapkan paket-paket dependensi Go backend dan React frontend:
```bash
make setup
```

### 2. Docker Full-Stack (Direkomendasikan)
Anda dapat langsung menjalankan seluruh aplikasi (PostgreSQL + InfluxDB + Go Backend + React Frontend) menggunakan Docker Compose:

* **Mode Development** (Frontend dijalankan via Vite dev server dengan HMR):
  ```bash
  make up-dev
  # Frontend: http://localhost:5173
  # API Backend: http://localhost:8080
  ```
* **Mode Production** (Frontend disajikan sebagai static files via Nginx + backend binary):
  ```bash
  make up
  # Frontend: http://localhost (Port 80)
  # API Backend: http://localhost:8080
  ```

Untuk mematikan container, jalankan `make down` (atau `make down-dev`). Untuk melakukan kompilasi ulang bersih, jalankan `make rebuild` (atau `make rebuild-dev`).

### 3. Setup Token InfluxDB 3 (Opsional)
Jika Anda mengaktifkan metrics InfluxDB dan ingin menghindari error authentication di backend, jalankan perintah berikut setelah container Docker berhasil berjalan:
```bash
make influx-token
```
Perintah ini akan secara otomatis membuat token admin baru di dalam container InfluxDB 3, menambahkannya ke file `.env` lokal Anda sebagai `INFLUX_TOKEN`, dan menyetel `INFLUX_ENABLED=true`.

---

### 4. Menjalankan Server Lokal Manual (Tanpa Docker)
Jika Anda ingin menjalankan server dan database secara terpisah tanpa Docker:
```bash
# Jalankan database PostgreSQL & InfluxDB 3 saja:
docker compose -f docker/docker-compose.yml up -d postgres influxdb3

# Jalankan Go backend dan Vite dev server secara bersamaan:
make dev
# API Backend: http://localhost:8080
# Frontend: http://localhost:5173
```

Untuk menjalankan test unit:
```bash
go test ./...                            # unit (cepat, tanpa Docker)
make test-integration-full               # DB + business layer (tags: integration dbtest)
```


## Pemakaian

```go
// Setup persistent connection (1 router = 1 login sepanjang umur app).
cfg, _ := config.LoadFromEnv()
mgr, _, _ := roslib.NewFromConfig(ctx, cfg, log)
defer mgr.CloseAll()
dev, _ := mgr.Get(roslib.DefaultDeviceKey)

// Sub-client per resource (sharing async + tag demux).
hot := hotspot.New(dev)
sys := system.New(dev)

// Snapshot
users, _ := hot.UserList(ctx)

// Mutation
id, _ := hot.UserAdd(ctx, hotspot.UserAddArgs{Name: "voucher-001", Profile: "1day"})

// Live streaming hotspot active (snapshot + delta)
hot.ActiveStream("dashboard-active", func(s *roslib.Sentence) {
    log.Printf("active: user=%s addr=%s uptime=%s", s.Get("user"), s.Get("address"), s.Get("uptime"))
})

// Scheduled poll (CPU/RAM/uptime tiap 5s, interval-group batching otomatis)
sys.MonitorResource("dash-cpu", 5*time.Second, func(s *roslib.Sentence) {
    log.Printf("cpu=%s mem=%s uptime=%s", s.Get("cpu-load"), s.Get("free-memory"), s.Get("uptime"))
})

// Cached read (profile dropdown, dll yang jarang berubah)
profiles, _ := hot.ProfileListCached(ctx, 60*time.Second)
```

## Struktur

Lihat [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Ringkas:

```
domain/                shared types
mikrotik/              command wrapper per modul (thin, no business logic)
scripts/               RouterOS script generator (string templating)
workflows/             cascade orchestration
api/                   gin REST + SSE (dto, handler, middleware, sse broker)
cmd/server/            entry point HTTP API
internal/config/       HTTP server config loader
internal/rosfmt/       format helpers
internal/tcpmock/      mock TCP server
internal/testutil/     integration test helper
test/integration/      build tag: integration
```

## Cross-reference ke analisis

Tiap exported function di `mikrotik/` & `scripts/` punya doc comment yang menyebut section di [`../mikhmonv3-analisis.md`](../mikhmonv3-analisis.md), mis. `// UserAdd → §1.6`. Lihat juga [docs/COMMANDS.md](docs/COMMANDS.md), [docs/SCRIPTS.md](docs/SCRIPTS.md), [docs/WORKFLOWS.md](docs/WORKFLOWS.md).

## Konvensi

Lihat [AGENTS.md](AGENTS.md) — dipakai oleh AI agent (Cascade/Claude) untuk konsistensi diff.

## Lisensi

MIT, mengikuti `roslib`.
