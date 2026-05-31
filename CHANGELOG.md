# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versi pakai semantic versioning.

## [Unreleased]

### Added

- **Full-Stack Dockerization (Prod & Dev)**:
  - Dockerfile multi-stage untuk compile backend Go secara efisien dan minimal.
  - Multi-stage `web/Dockerfile` (production) untuk compile React web frontend, disajikan menggunakan **Nginx** lengkap dengan fallback routing `nginx.conf` untuk mendukung React Router SPA.
  - `web/Dockerfile.dev` (development) untuk menjalankan Vite development server dengan support Hot Module Replacement (HMR) dan bind `--host`.
  - `docker/docker-compose.yml` (production) berisi PostgreSQL, InfluxDB3, Go backend server, dan React frontend server di port 80.
  - `docker/docker-compose-dev.yml` (development) berisi PostgreSQL, InfluxDB3, Go backend server, dan React frontend server di port 5173.
- **Skrip Go Otomatisasi Cross-Platform**:
  - `scripts/setup/main.go` untuk setup awal (cloning file `.env`), auto-generation kunci JWT dan crypto enkripsi secara acak yang aman tanpa `openssl`, serta auto-install npm packages via `pnpm` secara multi-platform (Windows, macOS, Linux).
  - `scripts/influx-token/main.go` untuk pembuatan admin token InfluxDB3 secara otomatis dari container Docker yang aktif dan menyimpannya langsung ke `.env`, memecahkan semua error authentication di backend Go.
- **Revamp Makefile Cross-Platform**:
  - Target `make setup` dan `make influx-token` dialihkan menggunakan skrip Go di atas agar bisa dijalankan di sistem operasi apapun tanpa shell dependencies.
  - Penambahan target-target docker compose lengkap untuk development dan production: `up-dev`, `down-dev`, `build-docker-dev`, `rebuild-dev`, serta `up`, `down`, `build-docker`, `rebuild`.

Refactor besar berdasarkan `ANALYSIS.md` — fase 1–4. Auth dan password
device encryption ditunda ke fase 5 (separate plan).

### Security

- **CORS default**: dari `*` (permissive) → kosong (same-origin only).
  Operator harus eksplisit set `CORS_ALLOWED_ORIGINS` untuk allow cross-origin.
- **SQL injection guard** di `parseHistoryParams.interval`: parse via
  `time.ParseDuration` + reformat ke canonical string sebelum interpolasi
  ke SQL `DATE_BIN INTERVAL '...'`.
- **TLS ke router**: `MikrotikDevice.UseTLS=true` sekarang benar-benar
  diteruskan ke `roslib.Options.TLS`. Sebelumnya silently di-ignore →
  device "TLS" dial plaintext. Self-signed cert opt-in via
  `DEVICE_TLS_INSECURE=true`.

### Added

- **Customer Portal (Fase 3, frontend)** — portal web pelanggan + landing page publik:
  - **Landing page** (`/`) — hero, paket real dari `GET /public/packages`, fitur, FAQ accordion,
    form pendaftaran embedded (reuse `PublicRegister`). Navbar responsif. Admin dashboard
    dipindah ke `/dashboard` agar root bisa jadi halaman publik.
  - **Auth pelanggan** (`/portal/login`) — form nomor HP + password, JWT scope `customer_access`
    disimpan di localStorage via `usePortalAuthStore` (Zustand terpisah dari admin).
    `portalApiClient` (axios terpisah) inject token customer; 401 → clear + redirect login.
  - **Portal shell** — layout phone-frame (`max-w-[480px] mx-auto`, `border-x md:shadow-lg`),
    bottom tab bar sticky 4 tab (Beranda/Tagihan/Langganan/Akun) + badge tagihan belum lunas.
  - **Beranda** (`/portal`) — status layanan (badge), hero card tagihan belum lunas, ringkasan
    langganan, quick links.
  - **Tagihan** (`/portal/invoices`, `/:id`) — list dengan filter chips (Semua/Belum Bayar/
    Terlambat/Lunas); detail dengan **QR code besar** (`QRCodeSVG`) + kode monospace + tombol
    Salin + instruksi petugas. QR/kode hanya tampil untuk tagihan unpaid.
  - **Riwayat Pembayaran** (`/portal/payments`) — kartu per pembayaran (metode, status badge,
    nominal, tanggal konfirmasi).
  - **Langganan** (`/portal/subscriptions`) — detail paket, username, status (+ warning isolir),
    tanggal tagih berikutnya, sync-status info.
  - **Akun** (`/portal/profile`) — data diri read-only, **ganti password** (Sheet drawer),
    toggle dark/light mode, tombol Keluar.
  - **Tiket** (`/portal/tickets`) — mock data + banner "backend belum implementasi".
    *(Backend endpoint tickets = roadmap Fase 4/5.)*
  - Semua data real dari backend (endpoint `/customer/*`); skeleton loading + empty state
    + error state di semua halaman.

- **Customer Portal (Fase 3, backend) + pembayaran via kode unik/QR** — self-service pelanggan:
  - **Scope auth terpisah**: `auth.CustomerClaims` (typ `customer_access`) + `SignCustomerAccess`/
    `VerifyCustomerAccess` + `middleware.RequireCustomerAuth`. Token staff & customer saling tolak.
    `Customer.portal_password_hash` baru; login nomor HP + password (`service/portal`).
  - Endpoint `POST /api/customer/login` (publik) + zona `/api/customer/*` (customer token): `me`,
    `subscriptions`, `subscriptions/:id/status`, `invoices` (+`:id`), `payments`, `change-password`.
    Semua di-scope ke `CustomerID` token (anti-IDOR).
  - **Kode unik + QR per invoice** (`Invoice.payment_code`, partial-unique + backfill invoice
    belum-lunas; `qr_content` di-render sisi-klien). Di-generate saat invoice dibuat
    (`service/billing` + handler generate) via `store.NewPaymentCode`.
  - **Settle-by-code** `POST /api/v1/payments/collect {code}` (petugas/staff): catat pembayaran
    `cash` `confirmed` instan + invoice `paid` + pulihkan layanan (outbox `pending_profile_change`/
    `pending_enable`) + notifikasi. Idempoten via `IdempotencyKey="code:<code>"`. Logika settle
    diekstrak jadi helper bersama dengan `Confirm`; Confirm/Collect/Reject kini menulis audit.
  - Admin onboard: `POST /api/v1/customers/:id/portal-password` (admin+operator).
  - OpenAPI: `paths/customer-portal.yaml`, `schemas/customer-portal.yaml`, tag **Customer Portal**.
  - Test: jwt customer claims, `service/portal` auth, handler `payments` collect (restore/idempotent),
    handler customer portal (scoping/anti-IDOR), + integration `customer_portal_flow` (dbtest).
- **Paket publik & form pendaftaran (Fase 2 lanjutan)** — agar landing page punya paket nyata:
  - Flag `is_public` pada `PPPProfile` + `HotspotProfile` (di-preserve saat sync router); store
    `ListPublic` (ppp aktif; hotspot aktif role `permanent`).
  - Endpoint publik baru `GET /api/public/packages` (tanpa auth, IP rate-limited) → paket
    `is_public` (id, service_type, name, price, rate_limit, description, device_id) untuk form
    pendaftaran. Handler `api/handler/packages.go` (+unit test).
  - `RegistrationCreateRequest` + model registrasi diperluas: `service_type` (pppoe|hotspot) +
    `hotspot_profile_id` — pilihan layanan & paket dari publik tersimpan sebagai hint operator.
  - DTO/handler profil DB (ppp/hotspot) menerima & mengembalikan `is_public`.
  - OpenAPI: `paths/packages.yaml`, `schemas/package.yaml`, field registrasi baru (bundled).
- **Registrasi Pemasangan (Fase 2)** — alur calon pelanggan → aktivasi:
  - Model & store `customer_registrations` (status pending/approved/rejected/cancelled +
    petugas + jadwal); seed setting `notification.admin_phone`.
  - Zone route **publik** pertama: `POST /api/public/registrations` (tanpa auth, IP rate-limited)
    → notifikasi `registration_received` ke admin.
  - Endpoint staff (admin+operator): `GET /registrations`, `GET /registrations/:id`,
    `POST /registrations/:id/{approve,reject,complete-install}`, `PUT /registrations/:id/assign`.
    `approve` membuat/menautkan Customer; `complete-install` membuat Subscription aktif
    (provisioning via outbox `pending_create`) + **invoice pertama** + notifikasi
    `installation_complete`. Semua aksi ubah-status dicatat di `audit_logs`.
  - `service/billing` — logika generate invoice diekstrak dari `billing_cron` agar dipakai
    ulang oleh registrasi & cron (DRY).
  - Integration test: `subscription_flow` (Customer + Subscription lifecycle current-API,
    tcpmock) menggantikan `business_layer_test` yang usang (fitur BandwidthProfile sudah dihapus);
    `expiry_workflow_test` di-port ke model HotspotProfile terbaru; `registration_flow` baru.
- **Notifikasi & WhatsApp (Fase 0+1)** — fondasi notifikasi + gateway WhatsApp embedded:
  - Model & store baru: `audit_logs`, `message_templates` (13 template default ter-seed),
    `notification_logs` (dengan jejak retry). Semua di-AutoMigrate.
  - `service/notification` — satu-satunya jalur kirim notifikasi (render `text/template`,
    tulis log, kirim via `Sender`). `NoopSender` untuk dev/test.
  - `service/notification/whatsapp` — klien **whatsmeow** embedded, sesi persisten di
    Postgres; login via QR oleh admin. Mengimplementasikan `Sender`.
  - Job `notif_retry` (tiap 5 menit) + reminder H-2 di `suspension_check`.
  - `billing_cron` → `invoice_issued`; `suspension_check` → `invoice_overdue`/`service_isolir`/
    `service_suspended`/`invoice_reminder` (best-effort, async).
  - `service/audit` — helper `audit.Log()` non-fatal untuk jejak ubah-status.
  - Endpoint admin baru: `GET /audit-logs`, `GET/PUT /message-templates`,
    `GET /notifications`, `GET /whatsapp/{status,qr}`, `POST /whatsapp/{logout,test}`.
    OpenAPI di-update + bundle.
- **`DeviceResponse.time_zone`** — field IANA timezone router (mis. `"Asia/Jakarta"`).
  Di-fetch otomatis dari `/system/clock` saat devmgr connect, di-persist ke DB,
  dan di-expose di API response. Dipakai expiry service untuk parsing timestamp
  comment dengan timezone yang benar. Kosong = UTC fallback.
- **`store.DeviceStore.UpdateTimezone`** — method baru untuk update kolom `time_zone`
  di DB secara selektif (tanpa re-encrypt password).
- **Middleware attach**: `Recovery`, `RequestID`, `Logger`, `CORS`
  sekarang aktif di gin engine (sebelumnya didefinisikan tapi tidak
  dipasang). `X-Request-ID` ter-echo di response header + log entry.
- **`/healthz` dependency check**: cek DB ping, count device
  connected vs total, Influx, SSE subscriber + drop count.
  Status 503 kalau DB down atau device aktif tapi 0 connected.
- **Voucher batch generator** (`POST /hotspot/vouchers/generate`):
  workflow `workflows.GenerateVouchers` + handler + DTO. Charset
  exclude karakter ambigu (`i`, `l`, `o`, `0`, `1`, `I`, `O`).
  Validity terisi → expiry stamp di-attach ke comment user (format
  mikhmonv3 lowercase month). Partial failure → 207 Multi-Status
  dengan vouchers yang sudah berhasil.
- **Report selling endpoints**:
  - `GET /reports/selling` — list dengan filter `?month=`.
  - `GET /reports/selling/today` — list per tanggal hari ini.
  - `GET /reports/selling/summary` — agregat count/total/profit/by_profile.
  - `GET /reports/selling.csv` — CSV export download.
  Endpoint tidak butuh device terhubung (data historis dari DB).
- **`store.DeviceStore.ListAll`** — varian tanpa filter `active=true`.
  Handler `Devices.List` sekarang pakai ini → operator bisa lihat
  device inactive untuk re-enable. Bootstrap service tetap pakai
  `List()` (filter aktif).
- **`devmgr.ErrDeviceNotConnected`** — sentinel error yang dapat
  dicek via `errors.Is` untuk diferensiasi disconnect vs internal error.
- **`devmgr.RemoveAndWait`** — varian `Remove` yang menunggu supervisor
  goroutine roslib benar-benar exit. Dipakai `Devices.Update` saat
  re-dial koneksi baru.
- **`roslib.Device.CloseAndWait`** — base API baru di library roslib.
  `Close` tetap async; `CloseAndWait` tambahan `sync.WaitGroup.Wait`
  untuk supervisor goroutines.
- **`sse.Hub.Stats()`** — expose per-topic subscriber + drop count
  untuk healthz / monitoring.
- **IP Pool CRUD API**: `GET /network/pools/by-name/:name`,
  `POST /network/pools`, `PUT /network/pools/:id`, dan
  `DELETE /network/pools/:id`.
- **SSE table streams**: `GET /stream/hotspot/users` dan
  `GET /stream/ppp/secrets`, termasuk `?mode=follow-only`.
- **SSE inactive streams**: `GET /stream/hotspot/inactive` dan
  `GET /stream/ppp/inactive` memakai derived workflow enabled user/secret
  minus active session.

### Changed

- **Hapus setting WhatsApp obsolet** (`notification.wa_api_url`, `notification.wa_sender`)
  dari seed `store/migrate.go` — peninggalan gateway **go-wa HTTP eksternal**. Dengan
  **whatsmeow embedded** tidak ada URL/sender eksternal; pengirim = akun yang login via QR.
  Tidak ada kode yang membaca keduanya. Setting yang tersisa: `wa_enabled`, `admin_phone`.
- **`expiry.ParseExpiry`** — tambah parameter `loc *time.Location`. Fallback ke
  `time.UTC` kalau nil. Pakai `time.ParseInLocation` supaya timestamp comment
  di-interpretasikan dalam timezone router, bukan UTC.
- **`expiry.runChecker`** — re-fetch device dari DB di tiap tick. Timezone yang
  di-update oleh devmgr saat reconnect langsung terpakai tanpa restart goroutine.
- **`devmgr.connect()`** — best-effort fetch timezone dari router via `cs.Sys.Clock()`
  setelah koneksi berhasil, sebelum fire `OnDeviceConnected`. Timezone di-persist
  ke DB sehingga `expSvc.Start()` membaca nilai yang benar saat bootstrap.
- **Expiry checker backoff state machine**: saat device disconnect,
  loop transisi ke backoff (30s → 10m, ×2 per gagal). Log sekali
  per transisi state (sebelumnya spam log "expiry: check failed"
  setiap tick). Recover otomatis saat device connect kembali.
- **`devmgr.persistStatus`**: status update DB pakai
  `context.Background()` + timeout 3s, bukan turunan root ctx. Status
  terminal ("closed", "error") tidak silently di-drop saat shutdown.
- **`Devices.Update`** pakai `RemoveAndWait` + surface reconnect
  error sebagai warning di response (tidak lagi silently swallow).
- **SSE broker `Publish`**: snapshot subscriber channel di-lock, lalu
  publish unlocked. Throughput lebih baik + race-free. Drop counter
  inc saat channel subscriber penuh.
- **SSE `Unsubscribe`**: tidak lagi `close()` channel (race detector
  warning pre-existing pada close-during-publish). Channel di-GC
  oleh runtime saat reference habis.
- **Queue stats SSE payload**: `GET /stream/network/queues/stats`
  sekarang memakai DTO typed dari `QueueStatsStreamParsed`, termasuk
  counter RouterOS lengkap (`bytes`, `packets`, `rate`, queued, total,
  dropped).
- **`metrics.startLocked` partial-failure tracking**: hanya panggil
  `Stop*` untuk stream yang berhasil register (cleanup pakai
  `[]startedStream` tracker). Sebelumnya panggil semua Stop blindly →
  log noise saat shutdown.

### Fixed

- **Expiry service timezone mismatch** — RouterOS menulis timestamp comment dalam
  jam lokal router, tapi `time.Parse()` menginterpretasikan sebagai UTC → user
  baru di-expire setelah offset timezone berlalu (UTC+7 = 7 jam terlambat). Fix:
  timezone router di-fetch dari `/system/clock` saat connect, di-persist ke DB,
  dan di-pass ke `ParseExpiry` via `time.LoadLocation`.
- **`expiry.ParseExpiry` off-by-one**: layout `"jan/02/2006 15:04:05"`
  20 chars, tapi parser pakai `[:19]` yang strip karakter terakhir.
  Plus token `"jan"` lowercase di Go time.Parse di-treat sebagai
  literal → hanya bulan Januari yang parsable. Fix: layout
  `"Jan/02/2006 15:04:05"` (case-insensitive) + `len(mikhmonLayout)`.
- **`expiry.executeExpiry` date formatting**: `time.Format("jan/02/2006")`
  output `"jan/<dd>/<yyyy>"` untuk semua bulan (literal "jan"). `SaleMonth`
  selalu jadi `"jan<year>"` → filter laporan bulanan broken. Fix:
  `strings.ToLower(now.Format("Jan/02/2006"))`.

### Tests

- `service/expiry/parser_test.go` — table-test ParseExpiry (valid,
  invalid, edge cases including off-by-one regression).
- `service/devmgr/manager_test.go` — Get sentinel error, ListActive
  copy semantics, buildTLSConfig + env opt-in.
- `api/sse/broker_test.go` — refcount start/stop, fan-out, dropped
  count, race detection (`-race`).
- `api/handler/helpers_test.go` — MapError table-test untuk semua
  sentinel + wrapped error.
- `api/handler/history_test.go` — interval validation termasuk SQL
  injection rejection.
- `api/handler/report_test.go` — aggregate helper.
- `api/middleware/middleware_test.go` — RequestID generate/preserve,
  Recovery envelope, CORS allowlist behavior.
- `workflows/generate_vouchers_test.go` — validation, randomString,
  buildVoucherAddArgs.
- `domain/charset_chars_test.go` — character set composition.
- `api/handler/network_pool_test.go` — HTTP handler IP Pool list,
  get-by-name, create, update, delete via `tcpmock`.
- `api/handler/stream_sse_test.go` — HTTP SSE writer tests untuk
  hotspot users, hotspot inactive, PPP secrets, PPP inactive, dan parsed
  queue stats.

### Documentation

- **README + `docs/API.md` + `docs/ARCHITECTURE.md`** — dokumentasi business layer
  (manajemen ISP): customers/subscriptions/billing/registrasi/notifikasi WhatsApp,
  tiga zone auth, endpoint inventory, quickstart docker-compose + integration test
  (`make test-integration-full`, catatan Podman/Ryuk). Tautan ke `goal.md`/`roadmap.md`.
- `docs/API.md` — voucher generator, reports, healthz dependency
  format, CORS default change, DEVICE_TLS_INSECURE env.
- `docs/openapi/*` — IP Pool CRUD paths, new SSE stream paths, dan
  stream event schemas.
- `.env.example` — CORS default kosong dengan comment warning.
