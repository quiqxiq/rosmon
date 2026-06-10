# Prompt Generator Issue — rosmon

Berisi prompt untuk AI agent yang menghasilkan `issue.md` (dokumen perencanaan)
per fitur. **Setiap prompt sudah disesuaikan dengan kondisi codebase saat ini.**

> PENTING — fitur Invoice, Payment, dan Suspension **sudah ada** di codebase
> (`main`). Jadi issue yang dihasilkan BUKAN greenfield, melainkan
> **audit + lengkapi gap + perkuat test**. Setiap issue WAJIB mencakup unit
> test (service-layer) dan integration test (`test/integration`).

---

## Konteks Codebase Bersama (sertakan di setiap prompt)

```
Repo: rosmon — ISP management untuk MikroTik. Branch default: main; kerjakan di branch feature lalu PR.
Baca dulu: CLAUDE.md + AGENTS.md (konvensi store/service/handler, naming, PR checklist).

Backend (Go monolith):
- Layering: api/handler (parse HTTP) → service/* (logika, TANPA import gin) → store/* (GORM saja).
  Job idempotent di job/*. Tipe murni di domain/*. Sekuens MikroTik di workflows/*. Client RouterOS di mikrotik/*.
- HTTP: gin. Base path /api/v1. Envelope respons via api/handler/helpers.go:
  WriteOK(c,data) → {"data":..}, WriteList(c,items,total) → {"data":[..],"total":n}, WriteErr/WriteValidationErr → {"error":{..}}.
- Auth zones (api/routes.go): publik; staff Bearer JWT (role admin>operator>viewer, middleware.RequireRole);
  customer portal JWT TERPISAH (middleware.RequireCustomerAuth) di prefix /customer/*.
- DB: GORM + AutoMigrate (BUKAN goose). Tambah model baru → update store/migrate.go di commit yang sama.
  Uang disimpan sebagai integer rupiah (int64), BUKAN decimal. Tanggal pakai type:date.
- Konfigurasi runtime di tabel system_setting (store.SettingStore), grup billing.*/notification.*/payment.*/general.*.
  JANGAN hardcode nilai ini (grace days, isolir profile, dll).
- Mutasi MikroTik = DB-first: tulis status mikrotik_sync_status=pending_*, return 200, lalu job/outbox.go
  yang push ke router (SKIP LOCKED). JANGAN sync MikroTik sinkron di handler.
- Setiap perubahan status subscription/invoice/payment WAJIB audit.Log() (service/audit).
- Waktu di service via Deps.NowFunc func() time.Time (bukan time.Now() langsung) demi testability.
- Notifikasi via service/notification (WhatsApp embedded + Telegram), template di tabel message_template
  (store/seed_templates.go), kirim NotifyAsync(...). Password jangan pernah masuk DTO/log biasa.

Frontend (web/, React 19 + TypeScript + Vite):
- TanStack Router (file-based, routes/_authenticated/*), TanStack Query, shadcn/ui, Tailwind, Zustand, react-hook-form + Zod.
- Per-fitur: features/<f>/{index.tsx, api/{service.ts,queries.ts,schema.ts}, components/, data/}.
- apiClient (lib/api/client.ts) baseURL=VITE_API_URL/api/v1, auto Bearer; portal-client.ts untuk portal.
  unwrap(res.data) buka envelope. queryKey via qk.* (lib/api/query-keys.ts).

Testing (WAJIB untuk setiap issue):
- Unit: go test ./... (make test / make test-race). Service diuji dengan store fake + NowFunc deterministik.
  Pola yang sudah ada: service/billing/service_test.go, service/payment/service_test.go, api/handler/payments_test.go,
  api/handler/subscriptions_test.go, service/portal/auth_test.go.
- Integration: make test-integration (build tag `integration`, ./test/integration/*), make test-integration-full
  (tags `integration dbtest`: Postgres testcontainer + MikroTik). MikroTik di-mock via internal/tcpmock /
  internal/testutil/mock.go. Pola: test/integration/billing_flow_test.go, customer_portal_flow_test.go,
  subscription_flow_test.go, scheduler_test.go, notification_test.go.
```

---

## Issue #3 — Invoice & Billing (audit + lengkapi + test)

Buatkan `issue.md` perencanaan untuk junior programmer / AI model murah.

[Sertakan "Konteks Codebase Bersama" di atas.]

### Status saat ini (SUDAH ADA — jangan bangun ulang, audit & lengkapi)
- Model `store/model/invoice.go` (+ `invoice_item.go`): `invoice_number` unik (format `INV-YYYY-MM-NNNN`
  via SequenceCounter), `customer_id`, `subscription_id`, `amount int64`, `period_start/period_end (date)`,
  `due_date`, `status` (`draft|issued|paid|cancelled`; `overdue` di-set oleh job), `payment_code`,
  `issued_at/paid_at`. UNIQUE `(subscription_id, period_start)` mencegah dobel.
- Service `service/billing/` — generate invoice per subscription; dipakai juga oleh alur registrasi.
- Job `job/billing_cron.go` — harian, generate invoice untuk subscription aktif yang `next_invoice_date`=hari ini. Idempotent.
- Endpoint staff: `GET /invoices`, `GET /invoices/:id` (viewer+); `POST /invoices/generate`, `POST /invoices/:id/cancel` (admin+operator).
- Customer portal: `GET /customer/invoices`, `GET /customer/invoices/:id`.
- Frontend: `web/src/features/invoices/`.
- Test eksisting: `service/billing/service_test.go`, `test/integration/billing_flow_test.go`.

### Tujuan issue
Audit kesesuaian implementasi dengan kebutuhan bisnis, lengkapi gap, dan PERKUAT test. Contoh area gap yang
harus dicek/diputuskan di issue: filter list (status/customer/bulan/jatuh tempo) lengkap & ber-index;
transisi status `issued→overdue` konsisten dengan job suspension; tampilan customer portal "Tagihan Saya";
i18n status badge; akurasi pembulatan rupiah (int64).

### Format Output `issue.md`
1. Gambaran umum + ringkasan "yang sudah ada vs yang kurang" (tabel).
2. Skema DB final (selaras `store/model/invoice.go`; amount int64; AutoMigrate).
3. Daftar endpoint (path `/api/v1/...` + envelope + zona auth), tandai mana yang sudah ada vs baru.
4. Komponen UI admin + customer portal (mengikuti pola features/* yang ada).
5. **Testing (wajib):**
   - Unit: generate invoice (NowFunc), idempotensi UNIQUE(subscription_id,period_start), cancel, transisi status.
   - Integration (`test/integration`): alur generate bulanan → terbit → tampil di portal; filter list.
   - Done jika `make test` & `make test-integration` hijau.
6. Tahapan berurutan + done criteria per tahap (termasuk "test hijau").

### Catatan
- High-level, tanpa kode implementasi. Pembaca junior. Bahasa lugas.
- Ikuti konvensi: envelope, AutoMigrate, audit.Log, NowFunc, system_setting (mis. `billing.invoice_due_days`, `billing.default_billing_day`).

---

## Issue #4 — Payment (Manual/Cash + Portal) (audit + lengkapi + test)

Buatkan `issue.md` perencanaan untuk junior programmer / AI model murah.
Bergantung pada Issue #3 (invoices). Sebutkan dependency ini di `issue.md`.

[Sertakan "Konteks Codebase Bersama" di atas.]

### Status saat ini (SUDAH ADA — audit & lengkapi)
- Model `store/model/payment.go`: `invoice_id`, `customer_id`, `amount int64`, `method` (`cash|transfer|portal|gateway`),
  `reference_number`, `proof_url`, `bank_name`, `status` (`pending|confirmed|rejected`), `confirmed_by/confirmed_at`,
  `rejection_reason`, `idempotency_key` (unik), serta field gateway (Xendit): `gateway_name/external_ref/gateway_response/invoice_url/expires_at`.
- Service `service/payment/` (+ adapter Xendit `service/payment/xendit.go`, webhook). Pembayaran confirmed → invoice `paid`.
- Endpoint staff: `GET /payments`, `GET /payments/:id`, `POST /payments` (catat manual),
  `POST /payments/collect`, `POST /payments/:id/confirm`, `POST /payments/:id/reject`.
- Customer portal: `POST /customer/invoices/:id/pay`, `GET /customer/payments`.
- Webhook publik gateway: `/public/webhooks/xendit`.
- Frontend: `web/src/features/payments/`.
- Test eksisting: `service/payment/service_test.go`, `api/handler/payments_test.go`.

### Catatan istilah (selaraskan dengan kode, JANGAN ganti enum)
- Status payment yang dipakai = `pending|confirmed|rejected` (BUKAN "verified"). "Verifikasi admin" = `confirm`.
- Metode = `cash|transfer|portal|gateway`. Bukti transfer = `proof_url` (+ `bank_name`, `reference_number`).

### TIGA jalur pembayaran — semua WAJIB ada + ditest (unit & integration)
1. **Manual cash/transfer (admin input):** `POST /payments` (method `cash`/`transfer`, opsional `proof_url`/`bank_name`/`reference_number`)
   → payment `confirmed` → invoice `paid` (`paid_at` di-set) → subscription tetap aktif → `audit.Log` → notif `payment_confirmed`.
   Idempotensi via `idempotency_key` (dobel-submit tidak menggandakan).
2. **Gateway Xendit (online):** customer/admin minta link bayar → `service/payment` + `service/payment/xendit.go` membuat
   Xendit invoice (simpan `gateway_name=xendit`, `external_ref`, `invoice_url`, `expires_at`; payment `pending`).
   Customer bayar di Xendit → Xendit memanggil **webhook publik `POST /public/webhooks/xendit`** (validasi header `x-callback-token`
   = setting `payment.xendit_webhook_token`) → status `paid` di Xendit dipetakan → payment `confirmed` + invoice `paid` → notif `payment_confirmed`.
   Konfigurasi dari system_setting: `payment.xendit_enabled`, `payment.xendit_secret_key`, `payment.xendit_webhook_token`,
   `payment.xendit_invoice_duration`, `payment.app_url`. Endpoint portal pemicu: `POST /customer/invoices/:id/pay` (saat gateway aktif → balikkan `invoice_url`).
3. **Portal upload bukti (customer manual):** `POST /customer/invoices/:id/pay` (gateway non-aktif) → upload bukti → payment `pending`, invoice tetap unpaid →
   admin `POST /payments/:id/confirm` (→ `paid`; recovery koneksi via Issue #5) atau `POST /payments/:id/reject` (notif `payment_rejected`, alasan di `rejection_reason`).
   Riwayat: `GET /customer/payments`.

### Format Output `issue.md`
1. Gambaran umum + tabel "sudah ada vs kurang". 2. Skema DB (selaras model, termasuk field gateway). 3. Ketiga jalur di atas (diagram alur per jalur).
4. Endpoint (path `/api/v1/...` nyata + zona auth + webhook publik). 5. Komponen UI admin (catat/konfirmasi/tolak) + portal (bayar online / upload bukti / riwayat).
6. **Testing (wajib) — matriks per jalur:**
   - **Unit (service/payment, NowFunc + store fake):** cash/transfer `confirm`→invoice `paid`; `reject`→invoice tetap unpaid + alasan;
     `idempotency_key` (submit dobel = 1 payment); Xendit: pembuatan invoice (mock HTTP Xendit) + **pemrosesan webhook** (token valid/invalid, event `paid`/non-paid, idempoten ulang-kirim);
     mapping status gateway → payment/invoice.
   - **Integration (`test/integration`, build tag `integration`):** (a) cash → invoice paid; (b) portal upload → admin confirm → invoice paid → (koneksi pulih lihat #5);
     (c) Xendit: minta link → simulasikan callback webhook `paid` → invoice paid; (d) webhook token salah → 401/abaikan; (e) portal `GET /customer/payments` menampilkan riwayat.
   - Done jika `make test` & `make test-integration` hijau; sertakan minimal 1 test per jalur (cash, xendit, portal).
7. Tahapan (backend service+webhook → admin UI → portal UI) + done criteria per tahap (termasuk "test per jalur hijau").

### Catatan
- High-level, tanpa kode. Dependency Issue #3. Idempotensi: `idempotency_key` (manual) & idempoten re-delivery webhook (`external_ref`).
- HTTP Xendit di-mock saat test (jangan panggil API asli). `service/payment/service_test.go` & `api/handler/payments_test.go` sebagai pola.
- Upload bukti: simpan path/URL (`proof_url`), bukan blob di DB. Nilai uang `int64` rupiah.

---

## Issue #5 — Pemutusan/Pemulihan Koneksi Otomatis (audit + lengkapi + test)

Buatkan `issue.md` perencanaan untuk junior programmer / AI model murah.
Bergantung pada Issue #3 (invoices) dan Issue #4 (payments). Sebutkan dependency di `issue.md`.

[Sertakan "Konteks Codebase Bersama" di atas.]

### Status saat ini (SUDAH ADA — audit & lengkapi)
- State machine status subscription (`store/model/subscription.go`): `active` → `isolir` (profil isolir, throttle) →
  `suspended` (disable keras) → `terminated`. Perubahan status TULIS KE DB; eksekusi ke MikroTik lewat `job/outbox.go`
  (field `sync_status=pending_*`). JANGAN disable PPP/hotspot langsung dari handler.
- Job harian `job/suspension_check.go` (09:00): (0) reminder H-2 `invoice_reminder`; (1) mark `overdue` + `invoice_overdue`;
  (2) isolir bila overdue ≥ `billing.isolir_after_days` → `service_isolir`; (3) hard suspend bila ≥ `billing.hard_suspend_after_days` → `service_suspended`.
  Nilai dari system_setting (mis. `billing.isolir_profile_name`). Pemulihan saat invoice `paid` → status `active` + notif `service_restored`.
- Job `job/reconciler.go` — deteksi drift & rekonsiliasi DB↔MikroTik (safety net).
- Manual suspend/aktifkan = `PATCH /subscriptions/:id/status` (nilai `active|isolir|suspended|terminated`) → sync via outbox.
- **TIDAK ADA tabel `connection_logs`** — jejak aksi pakai `store/model/audit_log.go` via `audit.Log()`. JANGAN buat tabel baru;
  pakai/lengkapi audit_log (action, entity=subscription, old/new, actor=user atau sistem).
- Test eksisting: `test/integration/subscription_flow_test.go`, `scheduler_test.go`, `expiry_workflow_test.go`.

### Dampak per status (WAJIB dijelaskan tuntas di issue.md — sumber: store/model/subscription.go + job/outbox.go)
Setiap perubahan status hanya ditulis ke DB (`subscriptions.status` + `sync_status=pending_*`); `job/outbox.go`
yang mengeksekusi ke MikroTik. Jelaskan untuk TIAP status: aksi MikroTik, `sync_status`, efek koneksi internet,
efek billing, efek akses portal, dan notifikasi.

| Status | sync_status (outbox) | Aksi MikroTik | Koneksi internet | Billing | Akses portal | Notifikasi |
|---|---|---|---|---|---|---|
| `pending_install` | `pending_create` | tambah PPP secret / hotspot user, profil normal, `disabled=no` | belum aktif | invoice pertama saat complete-install | login portal jika sudah punya password | `installation_complete` |
| `active` | `synced` / `pending_enable` | profil normal, `disabled=no` | NORMAL (full speed) | `next_invoice_date` jalan tiap `billing_cron` | penuh | `service_restored` (saat pulih) |
| `isolir` | `pending_profile_change` | ganti ke profil isolir (`billing.isolir_profile_name`, default `isolir`), `disabled=no` | TERBATAS/di-redirect ke halaman bayar (throttle), TIDAK putus total | invoice tetap berjalan/menunggak | tetap bisa untuk bayar | `service_isolir` |
| `suspended` | `pending_disable` | `disabled=yes` (PPP secret / hotspot user di-disable keras) | PUTUS total | menunggak; menunggu pembayaran | tetap bisa login untuk bayar | `service_suspended` |
| `terminated` | `pending_delete` | hapus PPP secret / hotspot user; set `terminated_at` | dihapus permanen | billing berhenti | record di-keep utk audit | — |

- Transisi balik (recovery): saat invoice `paid` (lewat payment confirmed) → status kembali `active`
  (`pending_enable` = `disabled=no` + restore profil normal) → notif `service_restored`.
- Ambang otomatis dari system_setting: `billing.isolir_after_days`, `billing.hard_suspend_after_days`,
  `billing.isolir_profile_name`. Outbox retry + eskalasi (`outbox_escalation`) bila MikroTik gagal.

### Tujuan issue
Audit kelengkapan alur otomatis & manual, pastikan idempotensi + audit trail, lengkapi notifikasi & UI tombol
manual (Putus/Aktifkan di halaman subscription/customer), dan PERKUAT test (skenario di bawah). Jika butuh
endpoint trigger cron manual untuk test (mis. `POST /jobs/suspension-check/run`), usulkan di issue (admin-only) — cek dulu apakah sudah ada.

### Skenario test yang WAJIB dicakup (integration, MikroTik via tcpmock)
1. Invoice overdue → job jalan → subscription `isolir`/`suspended` → outbox push ke router → notif terkirim.
2. Customer bayar (portal upload) → admin confirm → invoice `paid` → subscription `active` kembali → notif `service_restored`.
3. Admin catat cash payment → invoice `paid` → koneksi aktif.
4. Manual: admin PATCH status `suspended` → audit_log tercatat → outbox disable di MikroTik (tcpmock).
5. Invoice `cancelled` → koneksi tidak terpengaruh.
6. Idempotensi: job dijalankan 2x tidak menggandakan aksi/notifikasi.

### Format Output `issue.md`
1. Gambaran umum. 2. Logika bisnis otomatis & manual (selaras job + outbox + system_setting). 3. Audit trail (audit_log, BUKAN connection_logs baru).
4. Endpoint (PATCH status nyata + usulan trigger cron manual bila perlu). 5. Spesifikasi job/scheduler (jam, urutan, idempotensi, NowFunc).
6. **Testing (wajib) — per status + transisi:**
   - **Unit (job + service, NowFunc + store fake):** hitung hari overdue & pemilihan aksi (active→isolir pada `isolir_after_days`,
     isolir→suspended pada `hard_suspend_after_days`); pemetaan tiap status → `sync_status` benar
     (`active`→pending_enable, `isolir`→pending_profile_change, `suspended`→pending_disable, `terminated`→pending_delete);
     recovery `paid`→`active`; idempotensi job (jalan 2x = aksi/notif tidak dobel); pemilihan profil isolir dari system_setting.
   - **Integration (`test/integration`, MikroTik via tcpmock):** verifikasi EFEK TIAP STATUS sampai ke router (lewat outbox) —
     active (secret enabled, profil normal), isolir (profil isolir terpasang, tetap enabled), suspended (disabled=yes),
     terminated (secret terhapus), recovery (kembali enabled). Plus 6 skenario end-to-end di atas. Assert juga `audit_log` & notifikasi.
   - Done jika `make test` & `make test-integration` hijau; minimal 1 test per status + 1 per skenario.
7. Tahapan berurutan + done criteria per tahap. 8. Dependency Issue #3 & #4.

### Catatan
- High-level, tanpa kode. Pakai MikroTik mock (tcpmock/testutil) untuk test lokal — TIDAK perlu router fisik.
- Hormati DB-first + outbox; jangan sentuh MikroTik sinkron dari handler. Semua perubahan status → audit.Log.

---

## Urutan Pengerjaan yang Disarankan
- ~~Issue #2 → Password Customer & Notifikasi~~ — **SELESAI** (diimplementasikan & ditutup via PR #3/#8; portal password auto-generate saat aktivasi + reveal/edit/reset admin).
- Issue #3 → Invoice & Billing            (audit + test; independen)
- Issue #4 → Payment                      (audit + test; bergantung #3)
- Issue #5 → Pemutusan/Pemulihan Otomatis (audit + test; bergantung #3 & #4)

> Catatan umum semua issue: setiap PR WAJIB menyertakan unit test + integration test yang relevan dan
> `make test` + `make test-integration` harus hijau sebelum merge (lihat PR checklist di AGENTS.md).
