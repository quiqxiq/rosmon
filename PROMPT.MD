# MASTER PROMPT: Kembangkan Fitur pada Project ROSMON (MikroTik ISP Billing & Management)

Anda adalah AI Coding Assistant yang bertugas untuk mengembangkan dan memelihara aplikasi **rosmon**. Gunakan petunjuk berikut sebagai aturan utama dan referensi saat membaca atau menulis kode di repository ini.

---

## 1. DESKRIPSI & ARSITEKTUR PROYEK

**rosmon** adalah aplikasi monolitik ISP Billing & Management System terintegrasi dengan MikroTik.

### Request Flow
```
HTTP Request -> api/handler/ (parsing DTO) -> service/ (business logic) -> store/ (GORM DB access)
```
*   **MikroTik Sync Status (Outbox Pattern):** Aksi mutasi MikroTik dilakukan secara **asinkron**. Handler HTTP melakukan penulisan intended state ke DB terlebih dahulu, menyetel status sinkronisasi (`mikrotik_sync_status = pending_*`), dan langsung mengembalikan HTTP 200 ke klien. Sinkronisasi aktual ke MikroTik diproses secara background di `job/outbox.go` dengan mekanisme `FOR UPDATE SKIP LOCKED`.

### Struktur Folder Utama
*   `cmd/server/main.go`: Entry point utama aplikasi, inisialisasi server HTTP Gin, cron runner, dan dependency injection manual.
*   `api/`: Layer HTTP (Gin).
    *   `deps.go`: Struct `Deps` penyimpan seluruh interface store, service, gateway, dan limiter.
    *   `routes.go`: Definisi endpoint API dan pembagian 3 Auth Zone.
    *   `handler/`: Handler tipis untuk parsing input, memanggil service, dan serialisasi response.
    *   `dto/`: Request & Response struct dengan gin binding tags.
    *   `middleware/`: Middleware JWT auth staff/customer, rate limit, dsb.
    *   `sse/`: Hub Server-Sent Events real-time broker.
*   `service/`: Logika bisnis murni. **Tidak boleh mengimpor Gin atau menulis query database langsung.**
*   `store/`: Layer database (GORM).
    *   `model/`: GORM models.
    *   `migrate.go`: Berisi `AutoMigrate` dan seeding default (rosmon tidak memakai migration files / goose).
    *   `<entity>_store.go`: Mengikuti pattern interface public + private GORM implementation (cth: `store/user_store.go`).
*   `job/`: Cron jobs dan background worker (idempotent, cth: `billing_cron.go`, `suspension_check.go`, `notif_retry.go`).
*   `workflows/`: Kumpulan step pendaftaran, pembuatan voucher, dsb.
*   `mikrotik/`: Klien API RouterOS (sudah stabil, jangan dimodifikasi).
*   `web/src/`: Aplikasi frontend SPA (React 19, TypeScript, Vite, TanStack Router + Query, Tailwind CSS, shadcn/ui, Zustand).

---

## 2. KEPUTUSAN ARSITEKTUR YANG SUDAH BAKU

1.  **MikroTik adalah Source of Truth operasional.** DB hanya menyimpan *intended state*. `pppoe_username` adalah satu-satunya join key ke router.
2.  **DB-First Write + Outbox.** Seluruh perubahan subscription/layanan ditulis ke DB dulu, lalu di-sync di background oleh outbox worker.
3.  **Anniversary Billing.** `subscription.billing_day` adalah tanggal tagih subscription tersebut. Jika NULL, gunakan fallback `system_settings['billing.default_billing_day']`.
4.  **Dua Strategi Suspend:**
    *   *Isolir:* Mengganti profile secret/hotspot MikroTik ke kecepatan rendah (profil dibaca dari `system_settings`).
    *   *Hard Suspend:* Menonaktifkan (disable) secret PPPoE / user Hotspot.
5.  **WhatsApp Integration & Notification.** Pengiriman pesan WhatsApp hanya boleh dilakukan lewat `service/notification`. Memakai embedded library `whatsmeow`.
6.  **Staff Roles & Auth:** Admin > Operator > Viewer. Role check menggunakan middleware `RequireRole(auth.RoleAdmin)`.
7.  **Customer Scope Portal.** Terpisah dari staff. Customer menggunakan JWT `auth.CustomerClaims` dan divalidasi via middleware `RequireCustomerAuth`.
8.  **AutoMigrate, bukan Goose.** Database schema diatur di `store/migrate.go`. Jika ada model baru wajib daftarkan di struct `Migrate` dalam commit yang sama.

---

## 3. ATURAN WAJIB MENULIS KODE (BACKEND)

1.  **Service tidak memiliki HTTP dependency:** Jangan import `github.com/gin-gonic/gin` di dalam folder `service/`.
2.  **Store tidak memiliki business logic:** Hanya query database. Metode `List` di store selalu mengembalikan tuple `([]T, int64, error)` (slice hasil + total count) untuk menghindari N+1 query.
3.  **Job harus idempotent:** Aman dijalankan berulang tanpa efek samping ganda.
4.  **Audit Logs:** Aksi mutasi status/entitas wajib dicatat menggunakan helper `audit.Log(ctx, userID, action, entityType, entityID, oldJSON, newJSON)`. Gunakan `userID = 0` untuk aksi otomatis sistem.
5.  **Kredensial Aman:** Kunci rahasia seperti `pppoe_password` dan `portal_password_hash` **tidak boleh** dimasukkan ke dalam DTO response atau log dalam kondisi apa pun.
6.  **Gunakan System Settings:** Dilarang melakukan hardcode konfigurasi (seperti grace period atau profil isolir). Baca dari tabel `system_setting` via `SettingStore`.
7.  **Loop Panjang & Goroutine:** Wajib mengecek pembatalan konteks (`ctx.Done()`) pada setiap iterasi loop panjang:
    ```go
    for _, item := range items {
        select {
        case <-ctx.Done(): return ctx.Err()
        default:
        }
        // Proses item
    }
    ```
8.  **Injectable Time:** Di dalam service `Deps`, inject `NowFunc func() time.Time` alih-alih memanggil `time.Now()` langsung agar service mudah diuji di file unit test (`service_test.go`).
9.  **Sentinel Errors:** Gunakan error bawaan dari `store/errors.go` (seperti `ErrNotFound`, `ErrDuplicate`, `ErrConstraint`).

---

## 4. ATURAN WAJIB MENULIS KODE (FRONTEND)

1.  **Jangan Hardcode Server Name MikroTik:** Ambil daftar server hotspot dari API `/devices/:id/hotspot/servers` menggunakan hook `useHotspotServers(routerId)`.
2.  **File `data/data.ts` Bersih:** Hanya berisi opsi statis dan fungsi helper UI. Dilarang menaruh data mock atau faker di sini.
3.  **Form & Backend DTO Sync:** Nama field pada form frontend harus sama persis dengan binding tag JSON di DTO backend (contoh: `batch_size`, `length`, `charset`, `user_mode`).
4.  **Nilai Charset MikroTik:** Gunakan `lower`, `upper`, `mixed`, `number`, `lower_number`, `upper_number`, `mixed_number`.
5.  **Helper Components UI:**
    *   Gunakan `PasswordInput` (`@/components/password-input`) untuk input password dengan toggle show/hide.
    *   Gunakan `InputGroup` / `InputGroupAddon` / `InputGroupInput` untuk input angka beserta satuannya (misal: limit data MB/GB).
    *   Gunakan `ContentSection` (`features/settings/components/content-section`) pada halaman pengaturan.

---

## 5. COMMANDS OPERASIONAL & PENGUJIAN

### Backend (Go)
*   `make run` : Menjalankan backend Go (membaca `.env`).
*   `make dev` : Menjalankan backend Go dan frontend React bersamaan.
*   `make build` : Mengompilasi seluruh package backend.
*   `make test` : Menjalankan seluruh unit test backend.
*   `make test-race` : Menjalankan unit test dengan race detector.
*   `make lint` : Menjalankan `golangci-lint` check.
*   `make test-integration` / `make test-integration-full` : Menjalankan integration test (membutuhkan MikroTik router aktif pada localhost:8728).

### Frontend (React - di dalam folder `web/`)
*   `pnpm dev` : Menjalankan dev server Vite (http://localhost:5173).
*   `pnpm build` : Memvalidasi tipe TypeScript dan mem-build asset production.
*   `pnpm lint` / `pnpm format` : Memeriksa kode via ESLint / Merapikan format kode via Prettier.
*   `pnpm test` : Menjalankan unit test frontend.

### OpenAPI & Infra
*   `make setup` : Konfigurasi awal (membuat `.env`, JWT secrets, crypto key).
*   `make up-dev` / `make down-dev` : Manajemen postgres + influxdb + backend dev stack di docker.
*   `make openapi-bundle` : Menggabungkan potongan spec API ke file tunggal `docs/openapi/openapi.bundle.yaml`.

---

## 6. ALUR PENGEMBANGAN FITUR BARU (CHECKLIST)

Gunakan checklist ini setiap kali Anda menambahkan model atau domain baru ke sistem:

1.  [ ] **GORM Model:** Tambahkan model baru di `store/model/<entity>.go` beserta status konstan.
2.  [ ] **AutoMigrate:** Daftarkan struct model baru di dalam `store/migrate.go`.
3.  [ ] **Store Interface & Impl:** Buat interface public dan implementasi private GORM di `store/<entity>_store.go`.
4.  [ ] **Service Layer:** Implementasikan logika bisnis di `service/<domain>/service.go` memakai struct dependencies.
5.  [ ] **Unit Tests:** Buat test suite di `service/<domain>/service_test.go` yang memvalidasi minimal 1 happy path dan 1 error case.
6.  [ ] **DTO Structs:** Definisikan Request/Response model dan mapper function di `api/dto/<entity>.go`.
7.  [ ] **HTTP Handler:** Buat handler Gin di `api/handler/<entity>.go` lengkap dengan fungsi `Register(g *gin.RouterGroup)`.
8.  [ ] **API Wiring:**
    *   Daftarkan service & store baru di dependency injection struct `api/deps.go` dan `cmd/server/main.go`.
    *   Mount route handler baru di file `api/routes.go`.
9.  [ ] **OpenAPI Spec:** Tulis endpoint spec baru di folder `docs/openapi/`, lalu lakukan bundling menggunakan `make openapi-bundle`.
10. [ ] **Frontend (Bila Diperlukan):**
    *   Buat file-based routes di `web/src/routes/`.
    *   Buat fitur baru di `web/src/features/<feature>/` yang memisahkan service API, queries (TanStack Query), schemas (Zod), dan UI components.
