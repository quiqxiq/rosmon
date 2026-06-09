# goal.md — Visi & Tujuan Pengembangan Rosmon

> Dokumen visi sistem manajemen ISP **Rosmon**. Disusun dari pembacaan
> langsung kondisi codebase (branch `feat/backend-integration`), bukan
> dari desain ideal. Status setiap fitur mengacu pada kode yang benar-benar
> ada di repo per 2026-05-30.
>
> Referensi: [`AGENTS.md`](AGENTS.md) (konvensi baku), [`system-design.md`](system-design.md)
> (desain teknis), serta dua proyek ISP eksternal sebagai inspirasi fitur:
> [`mikhmon/`](mikhmon/) (manajemen hotspot/voucher PHP) dan
> [`billing-rtrw/`](billing-rtrw/) (billing + portal multi-peran Node.js).

---

## 1. Ringkasan

Rosmon adalah sistem manajemen ISP/RT-RW Net berbasis MikroTik yang
dikemas dalam **satu binary Go** (backend Gin + background jobs) plus
**satu dashboard React/TypeScript** ([`web/`](web/)). Data bisnis disimpan
di **PostgreSQL** (via GORM), metrik time-series di **InfluxDB**.

Prinsip pembeda Rosmon dari tool sejenis:

- **MikroTik = source of truth operasional.** Database hanya menyimpan
  *intended state* + data bisnis. `MikrotikUsername` adalah satu-satunya
  join key ke router.
- **DB-first + outbox.** Mutasi yang menyentuh router ditulis ke DB lebih
  dulu, HTTP response langsung kembali, sinkronisasi ke MikroTik dilakukan
  background goroutine dengan `FOR UPDATE SKIP LOCKED`. Sistem tetap
  konsisten walau router sedang offline.
- **Satu repo, satu deploy.** Tidak ada microservice. Job, API, dan
  integrasi MikroTik hidup dalam proses yang sama.

Sistem ini **bukan greenfield** — perkiraan kelengkapan ~60–70%. Inti
billing, suspensi, dan provisioning sudah berjalan; lapisan pelanggan
(portal, registrasi, notifikasi WhatsApp, payment gateway) adalah arah
pengembangan utama berikutnya.

---

## 2. Status Sistem Saat Ini (Hasil Pembacaan Codebase)

Legenda: ✅ sudah ada & berjalan · 🟡 sebagian / perlu pelengkap · ⬜ belum ada

### 2.1 Yang Sudah Berjalan ✅

| Area | Bukti di codebase | Catatan |
|---|---|---|
| **Multi-device MikroTik** | `service/devmgr/`, `store/device_store.go` | DeviceManager dial semua router dari DB, lifecycle hooks ke expiry & metrics |
| **MikroTik wrappers** | `mikrotik/{ppp,hotspot,network,system,syslog}/` | Production-ready, tidak boleh diubah |
| **Auth staff (JWT)** | `service/auth/`, `api/middleware/auth.go` | HS256, access+refresh, rotasi refresh token, role admin/operator/viewer |
| **Enkripsi credential** | `store/crypto.go` | AES-256-GCM untuk password device & `Subscription.MikrotikPassword` |
| **Rate limiting** | `api/middleware/ratelimit.go`, `internal/ratelimit/` | per-IP, per-user, heavy-endpoint |
| **SSE real-time** | `api/sse/`, `api/handler/stream.go` | traffic / active / log streaming dengan cap per-topic & per-device |
| **Metrik InfluxDB** | `service/metrics/`, `api/handler/history.go` | per-device, opsional (`INFLUX_ENABLED`) |
| **Customer CRUD** | `store/model/customer.go`, `store/customer_store.go`, `api/handler/customers.go` | status `aktif`/`nonaktif` |
| **Paket layanan** | `store/model/ppp_profile.go` + `hotspot_profile.go` (punya `PriceMonthly`) | lihat catatan deviasi §2.3 |
| **Subscription lifecycle** | `store/model/subscription.go`, `api/handler/subscriptions.go` | pppoe **dan** hotspot permanen; status pending_install→active→isolir→suspended→terminated |
| **Outbox syncer** | `job/outbox.go` | ticker 10 dtk, batch 20, `SKIP LOCKED`, 5 state sync (create/profile_change/disable/enable/delete), dukung pppoe+hotspot |
| **Billing otomatis** | `job/billing_cron.go` (07:00) | anniversary via `NextInvoiceDate`, nomor `INV-…` dari `sequence_counters`, idempotent `UNIQUE(subscription_id, period_start)` |
| **Isolir & suspend otomatis** | `job/suspension_check.go` (09:00) | overdue → isolir (`isolir_after_days`) → hard suspend (`hard_suspend_after_days`), ambang dari `system_settings` |
| **Invoice & Payment** | `store/{invoice,payment}_store.go`, `api/handler/{invoices,payments}.go` | payment manual (`manual_transfer`/`cash`) + konfirmasi admin |
| **System settings** | `store/setting_store.go`, seed di `store/migrate.go` | key billing.* & notification.wa_* sudah di-seed |
| **Dashboard admin** | `web/src/features/` (18 modul) | dashboard, customers, subscriptions, routers, ppp, hotspot, network, system, traffic, report, settings, users, voucher, log, dll |
| **Dokumentasi API** | `docs/openapi/`, `docs/scalar/` | OpenAPI bundle + Scalar UI di `/docs` |

### 2.2 Yang Masih Kosong / Belum Tersambung ⬜

| Area | Status | Dampak |
|---|---|---|
| **Service notifikasi** (`service/notification/`) | ⬜ belum ada | Tidak ada satu pun notifikasi terkirim, padahal alur bisnis mengasumsikannya |
| **WhatsApp gateway** | ⬜ belum ada | Setting `notification.wa_*` ter-seed tapi tidak dibaca kode mana pun |
| **`message_templates`** (model/store/seed) | ⬜ belum ada | Tidak ada template pesan ter-render |
| **`notification_logs`** + `job/notif_retry.go` | ⬜ belum ada | Tidak ada jejak/retry pengiriman |
| **`audit_logs`** + helper `audit.Log()` | ⬜ belum ada | AGENTS.md mewajibkannya untuk aksi ubah-status, tapi belum diimplementasi |
| **`customer_registrations`** (model→flow) | ⬜ belum ada | Tidak ada antrian pendaftaran calon pelanggan |
| **Customer JWT scope** (`auth.CustomerClaims`, `RequireCustomerAuth`) | ⬜ belum ada | Prasyarat customer portal |
| **Customer portal** (`/api/customer/*` + frontend) | ⬜ belum ada | Pelanggan belum bisa self-service |
| **Payment gateway** (Xendit/Tripay + webhook) | ⬜ belum ada | Model `payments` belum punya `external_ref`/`gateway_response` |
| **Landing page** publik | ⬜ belum ada | Belum ada halaman pemasaran + form daftar |
| **`reconciler` job** (drift detection) | ⬜ belum ada | Drift DB↔router tidak terdeteksi otomatis |

### 2.3 Deviasi Penting dari `system-design.md` (Wajib Diperhatikan)

Desain awal sudah berevolusi di kode. Dokumen turunan **harus** mengikuti
kode, bukan desain lama:

1. **Tidak ada tabel `bandwidth_profiles`.** Paket layanan diwakili oleh
   `ppp_profiles` (PPPoE) dan `hotspot_profiles` (hotspot), masing-masing
   punya kolom `PriceMonthly`. `Subscription` memakai FK spesifik tipe
   (`PPPProfileID` *atau* `HotspotProfileID`), bukan satu `bandwidth_profile_id`.
2. **Subscription mendukung dua tipe layanan**, bukan PPPoE saja.
   Field `ServiceType` (`pppoe`|`hotspot`), join key `MikrotikUsername`,
   unique compound `(device_id, service_type, mikrotik_username)`.
3. **Belum ada lapisan `service/` untuk billing/subscription/notification.**
   Logika bisnis saat ini tinggal di handler (`subscriptions.go` ~21KB) dan
   job. Idealnya (per AGENTS.md) di-ekstrak ke `service/*`; ini utang teknis,
   bukan pemblokir.
4. **Hanya satu zone auth (staff) yang ter-wire.** Zone publik dan zone
   customer belum ada di `api/routes.go`.
5. **`Customer` belum punya `portal_password_hash`; `Payment` belum punya
   field gateway.** Keduanya perlu migrasi tambahan saat fitur terkait dibangun.

---

## 3. Prinsip & Batasan Arsitektur (Tidak Dapat Ditawar)

Diturunkan dari [`AGENTS.md`](AGENTS.md). Setiap fitur baru wajib patuh:

1. **MikroTik source of truth**; DB = intended state. Join key tunggal:
   `MikrotikUsername`.
2. **DB-first + outbox** untuk semua mutasi yang menyentuh router. **Dilarang**
   memanggil MikroTik sinkron dari HTTP handler untuk operasi *mutasi*
   subscription (read live boleh).
3. **Notifikasi hanya lewat `service/notification`.** Tidak ada HTTP call
   langsung ke gateway WA dari handler/service lain.
4. **Service tanpa dependency HTTP**; **store tanpa business logic**;
   **job idempotent** (guard via unique constraint).
5. **Tidak ada konfigurasi hardcoded.** Nilai yang bisa berubah (nama
   profil isolir, grace period, dsb.) dibaca dari `system_settings`.
6. **Credential tidak pernah masuk log atau DTO response**
   (`MikrotikPassword`, `portal_password_hash`).
7. **Aksi yang mengubah status entitas utama dicatat di `audit_logs`**
   (begitu helper-nya ada).
8. **Migrasi via GORM AutoMigrate** di `store/migrate.go` — wajib di-update
   pada commit yang sama saat ada model baru.
9. **Role staff hierarkis** admin > operator > viewer; **customer** adalah
   scope JWT terpisah, tidak boleh menyentuh endpoint staff.

---

## 4. Tujuan Pengembangan — Fitur Utama

Delapan fitur prioritas, masing-masing dengan deskripsi, status aktual, dan
catatan implementasi yang menunjuk kondisi kode nyata.

### 4.1 Customer Portal (Self-Service) ⬜→🎯

Pelanggan login dan mengelola layanannya sendiri: lihat tagihan & histori,
bayar, kelola profil, lihat paket aktif, cek status koneksi live, dan ajukan
upgrade/downgrade paket.

- **Status:** ⬜ belum ada. `auth.CustomerClaims` & `/api/customer/*` baru
  dirancang di AGENTS.md/system-design.md.
- **Prasyarat teknis:** (a) `auth.CustomerClaims` + `Signer.SignCustomerAccess`
  + `middleware.RequireCustomerAuth`; (b) `Customer.portal_password_hash`
  (migrasi); (c) notifikasi WA untuk login OTP; (d) zone route customer baru.
- **Endpoint target:** `/api/customer/{me, subscription, subscription/status,
  invoices, invoices/:id/pay, payments}` (lihat §5 system-design).
- **Frontend:** modul `web/src/features/customer-portal/` baru + halaman login
  terpisah dari dashboard admin.
- **Inspirasi:** portal pelanggan billing-rtrw (cek tagihan, dashboard layanan,
  grafik trafik PPPoE sendiri, buat tiket).

### 4.2 Integrasi Payment Gateway (Xendit & Tripay) ⬜→🎯

Pembayaran online otomatis: customer bayar dari portal, status tagihan
ter-update otomatis lewat webhook, subscription yang isolir/suspend
dipulihkan otomatis.

- **Status:** ⬜ belum ada; disebut "fase berikutnya" di system-design.md.
  Pembayaran manual (transfer/cash + konfirmasi admin) sudah jalan.
- **Prasyarat teknis:** extend `model.Payment` (`external_ref`,
  `gateway_response`, method `xendit`/`tripay`); `service/payment/gateway`
  (interface + adapter per provider); endpoint webhook publik dengan
  verifikasi signature; idempotency via `IdempotencyKey` (sudah ada di model).
- **Reuse alur:** konfirmasi pembayaran sukses memicu jalur restore yang
  **sudah ada** (`pending_enable`/`pending_profile_change` → outbox).
- **Inspirasi:** billing-rtrw mendukung Midtrans/Tripay/Xendit/Duitku +
  webhook generik + pencocokan nominal unik/QRIS.

### 4.3 Integrasi WhatsApp via whatsmeow ⬜→🎯

Notifikasi otomatis ke pelanggan (tagihan terbit, reminder, isolir,
konfirmasi pemasangan, konfirmasi/penolakan pembayaran, dll.) dan setup/login
gateway via **QR code** oleh admin di dashboard.

- **Status:** ⬜ belum ada. Setting `notification.wa_*` ter-seed namun tidak
  dibaca. Diagram system-design menyebut "go-wa (HTTP gateway eksternal)".
- **Keputusan arsitektur:** gunakan **whatsmeow** (library Go embedded) alih-alih
  gateway HTTP eksternal — satu binary, tanpa dependency service luar. Sesi
  WhatsApp (device store whatsmeow) disimpan persisten; admin scan QR sekali
  dari dashboard.
- **Prasyarat teknis:** `service/notification` dengan interface `Sender`
  (`Send(ctx, phone, message)`), implementasi `WhatsmeowSender`; render
  template `text/template`; tulis `notification_logs` selalu (sukses/gagal);
  endpoint admin `GET /api/v1/whatsapp/qr` + status koneksi (via SSE).
- **Kepatuhan AGENTS.md:** semua pengiriman lewat `service/notification` saja.
- **Inspirasi:** billing-rtrw (Baileys: status koneksi, broadcast berantai,
  reset sesi, tes notifikasi).

### 4.4 Penagihan Otomatis Bulanan ✅ (pelihara & lengkapi)

Pembuatan invoice per-pelanggan sesuai jadwal anniversary.

- **Status:** ✅ sudah ada & berjalan — `job/billing_cron.go` (07:00) untuk
  PPPoE *dan* hotspot permanen, idempotent.
- **Pelengkap yang diinginkan:** kirim notifikasi `invoice_issued` saat
  invoice terbit (butuh §4.3); generate invoice manual/massal dari admin
  (inspirasi billing-rtrw "bayar/generate massal"); item invoice tambahan
  (biaya pasang, denda).

### 4.5 Landing Page Publik ⬜→🎯

Halaman publik untuk informasi & promosi layanan (paket, harga, cakupan
area, kontak), terpisah dari dashboard admin.

- **Status:** ⬜ belum ada.
- **Prasyarat teknis:** rute publik frontend; endpoint publik read-only untuk
  daftar paket aktif & info perusahaan (`general.company_name` sudah ada di
  settings). Memuat CTA ke form registrasi (§4.6).
- **Inspirasi:** halaman info billing-rtrw (S&K, privasi, tentang, kontak,
  beli voucher publik).

### 4.6 Registrasi Pemasangan via Landing Page ⬜→🎯

Calon pelanggan mengajukan pemasangan baru lewat form publik.

- **Status:** ⬜ belum ada. `POST /api/public/registrations` baru dirancang.
- **Prasyarat teknis:** `model.CustomerRegistration` (status pending/approved/
  rejected/cancelled + jadwal + petugas) + store + handler; zone route publik
  pertama; rate-limit anti-spam (per-IP limiter sudah ada); notifikasi
  `registration_received` ke admin (butuh §4.3).
- **Inspirasi:** registrasi online billing-rtrw + input pelanggan dari lapangan
  oleh teknisi.

### 4.7 Manajemen Registrasi di Dashboard Admin ⬜→🎯

Pengajuan masuk antrian admin untuk di-approve/tolak; saat approve, jadwal
pemasangan & penugasan operator dikirim ke calon pelanggan; saat tolak,
alasan dikirim. Operator menyelesaikan instalasi → subscription + invoice
pertama tergenerate otomatis.

- **Status:** ⬜ belum ada (front & back).
- **Prasyarat teknis:** endpoint `approve`/`reject`/`assign`/`complete-install`;
  `complete-install` membuat `Subscription` (status active) dengan
  `SyncStatus=pending_create` → outbox provision ke router (jalur outbox
  **sudah ada**); modul frontend `registrations/`.
- **Reuse:** provisioning PPPoE/hotspot lewat outbox tidak perlu kode baru.

### 4.8 Isolir Otomatis untuk Tunggakan ✅ (pelihara & lengkapi)

Isolir + hard suspend pelanggan yang melewati ambang keterlambatan,
dikonfigurasi via `system_settings`.

- **Status:** ✅ sudah ada — `job/suspension_check.go` (09:00) dengan dua
  strategi: ganti profil isolir & disable PPPoE/hotspot user. Eksekusi router
  lewat outbox.
- **Pelengkap yang diinginkan:** reminder H-2 sebelum jatuh tempo + notifikasi
  `service_isolir`/`service_suspended` (butuh §4.3); isolir/buka manual dari
  admin (inspirasi billing-rtrw); `isolir_after_days` per-pelanggan
  (override per-subscription) bila diperlukan.

---

## 5. Fitur Sekunder & Pelengkap (dengan Justifikasi)

Ditambahkan karena relevan teknis untuk ISP sekelas ini atau sudah
ter-implikasi di codebase/AGENTS.md.

| # | Fitur | Justifikasi singkat | Status |
|---|---|---|---|
| 5.1 | **Audit log** | Diwajibkan AGENTS.md untuk setiap aksi ubah-status (subscription/invoice/payment). Helper `audit.Log()` dirujuk tapi belum ada. Krusial untuk akuntabilitas multi-operator. | ⬜ |
| 5.2 | **Notification log + retry** | Tanpa jejak, kegagalan kirim WA tak terlacak. AGENTS.md: "notification log selalu ditulis meski gagal" + `job/notif_retry.go`. | ⬜ |
| 5.3 | **Reconciler / drift detection** | DB-first berarti DB dan router bisa drift (perubahan manual di Winbox). Job per-jam membandingkan & menandai selisih. | ⬜ |
| 5.4 | **Laporan keuangan & dashboard analitik** | Operator butuh ringkasan pendapatan, tunggakan, aging invoice, churn. Data sudah ada di invoices/payments. | 🟡 (data ada, agregasi belum) |
| 5.5 | **Manajemen area/zona** | `Customer.Area` masih teks bebas. Formalisasi jadi entitas → filter, laporan per-wilayah, penugasan teknisi. | 🟡 |
| 5.6 | **Tiket dukungan (trouble ticket)** | Saluran keluhan pelanggan→teknisi. Standar di billing-rtrw. Melengkapi customer portal. | ⬜ |
| 5.7 | **Ekspansi role (kasir/teknisi)** | Saat ini admin/operator/viewer. Operasi lapangan & kasir butuh peran terpisah dengan pembatasan aksi sensitif. | 🟡 |
| 5.8 | **Backup konfigurasi router & DB** | Operasional wajib: export config MikroTik + dump DB terjadwal dari panel. | ⬜ |
| 5.9 | **Manajemen voucher hotspot** | `transactions` (VoucherSale) + handler voucher sudah ada; lengkapi batch generate, template, cetak, export CSV. | 🟡 |
| 5.10 | **Telegram sebagai kanal alternatif** | `Sender` adalah interface — Telegram bisa jadi implementasi kedua tanpa ubah pemanggil. Berguna untuk notifikasi admin. | ⬜ |
| 5.11 | **FUP / jam kalong / usage tracking** | Fitur lanjutan PPPoE: ganti profil saat kuota habis atau pada jam tertentu; sinkron pemakaian dari counter sesi. Inspirasi billing-rtrw. | ⬜ |
| 5.12 | **Monitoring router & kesehatan sistem** | Metrik per-router (CPU/RAM/uplink) sudah sebagian via Influx; tambah halaman health + alert ambang. | 🟡 |

**Diakui sebagai aspirasi jangka jauh (di luar fokus dekat):** integrasi
GenieACS (TR-069 CPE), OLT PON via SNMP, peta jaringan GIS (Leaflet/ODP),
inventaris gudang, dan portal agen/reseller — semuanya ada di billing-rtrw
namun memperluas scope secara signifikan dan tidak diprioritaskan sebelum
fondasi pelanggan (portal, notifikasi, registrasi, payment) selesai.

---

## 6. Non-Goals (Eksplisit di Luar Scope Saat Ini)

- **Multi-tenant.** Satu instance = satu ISP.
- **Microservice / message broker.** Notifikasi retry cukup via DB; tidak
  ada Kafka/NATS (AGENTS.md).
- **Casbin / RBAC eksternal.** `RequireRole` sudah cukup.
- **Goose / migrasi SQL manual.** Tetap GORM AutoMigrate.
- **Mengubah lapisan `mikrotik/`, `scripts/`, `workflows/`** tanpa alasan
  kuat — production-ready.

---

## 7. Definisi Sukses

Sistem dianggap mencapai visinya bila:

1. Calon pelanggan bisa **mendaftar dari landing page** → admin approve →
   operator pasang → **subscription + invoice pertama otomatis**, semua
   tahap mengirim **notifikasi WhatsApp**.
2. Pelanggan aktif bisa **login portal**, melihat & **membayar tagihan
   online**, dengan **pemulihan layanan otomatis** setelah bayar.
3. Penagihan, isolir, dan suspend berjalan **tanpa intervensi manual**,
   dengan **audit trail** lengkap dan **notifikasi** di setiap transisi.
4. Operasi tetap **konsisten saat router offline** (outbox), dan **drift
   manual terdeteksi** (reconciler).

Roadmap bertahap untuk mencapai ini ada di [`roadmap.md`](roadmap.md).
