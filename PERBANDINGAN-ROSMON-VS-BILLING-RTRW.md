# Analisis Perbandingan Backend: Rosmon vs billing-rtrw

> Dokumen ini membandingkan **backend Rosmon** (Go monolith, repo ini) dengan
> **billing-rtrw** (`alijayanet/billing-rtrw`, Node.js/Express monolith) pada
> domain inti ISP: database, pelanggan, paket, billing/invoice, pembayaran,
> voucher hotspot, hotspot/PPPoE, dan **interaksi dengan MikroTik saat
> provisioning**.
>
> Tanggal analisis: 2026-06-02 · Rosmon @ branch `testing` · billing-rtrw v5.0.9

---

## 1. Ringkasan Eksekutif

| Aspek | **Rosmon** | **billing-rtrw** |
|---|---|---|
| Bahasa / runtime | Go 1.2x | Node.js ≥20 (CommonJS + 1 `.mjs`) |
| Web framework | Gin (REST/JSON API murni) | Express + EJS (server-rendered views) |
| Database | **PostgreSQL** via GORM (ORM) | **SQLite** via `better-sqlite3` (SQL mentah, sinkron) |
| Frontend | SPA terpisah (React 19 di `web/`) | Server-side rendered EJS (monolit penuh) |
| Pola arsitektur | Berlapis: handler → service → store | Berlapis longgar: routes → services → `db` |
| **Provisioning MikroTik** | **Asynchronous: DB-first + outbox** | **Synchronous: panggil API router langsung** |
| Skema billing | **Subscription-centric**, anniversary harian | **Customer-centric**, periode bulan/tahun |
| Penomoran invoice | `INV-YYYY-MM-NNNN` (sequence counter) | tanpa nomor formal (PK `id` + `period_month/year`) |
| Multi-tenant device | Device-scoped (`/devices/:id/...`) | Multi-router via `router_id` per pelanggan |
| Cakupan modul | Billing, hotspot, voucher, PPPoE, portal | Semua di atas **+ GenieACS (TR-069), OLT/SNMP, GIS/peta, inventaris, payroll, agen, kasir, kolektor, PPOB** |
| Gateway pembayaran | Xendit | Midtrans, Tripay, Xendit, Duitku (+ webhook generik) |

**Perbedaan filosofis terbesar:** Rosmon adalah aplikasi billing **fokus dan
modern** dengan jaminan konsistensi kuat (transaksi DB sebagai sumber kebenaran,
outbox idempoten ke router). billing-rtrw adalah **suite ISP serba-bisa** yang
sangat luas fiturnya tetapi memanggil MikroTik secara langsung/sinkron tanpa
lapisan rekonsiliasi.

---

## 2. Database & Skema

### 2.1 Teknologi penyimpanan

- **Rosmon** — PostgreSQL, dikelola GORM `AutoMigrate` (tanpa goose/migrasi
  manual). Model didefinisikan sebagai struct Go di `store/model/`. Constraint
  unik & index ditulis sebagai tag GORM, termasuk **partial unique index**
  (mis. `WHERE deleted_at IS NULL`, `WHERE payment_code <> ''`). Soft delete
  built-in lewat `gorm.DeletedAt`.
- **billing-rtrw** — SQLite file (`database/billing.db`) dengan akses sinkron
  `better-sqlite3`. Skema didefinisikan sebagai string `CREATE TABLE IF NOT
  EXISTS` di `config/database.js`. Tidak ada ORM; semua query SQL mentah dengan
  prepared statement. Memakai helper `NOW_LOCAL()` (custom function) untuk
  timestamp lokal.

### 2.2 Tabel inti — pemetaan

| Domain | Rosmon (PostgreSQL/GORM) | billing-rtrw (SQLite) |
|---|---|---|
| Pelanggan | `customers` | `customers` |
| Paket layanan | `ppp_profiles` + `hotspot_profiles` (terpisah per teknologi) | `packages` (satu tabel generik) |
| Langganan | **`subscriptions`** (entitas tersendiri) | *tidak ada* — atribut layanan menempel di `customers` |
| Tagihan | `invoices` + `invoice_items` | `invoices` (tanpa line-item) |
| Pembayaran | `payments` | *tidak ada tabel khusus* — status di `invoices` (`status='paid'`, `paid_at`, `paid_by_name`) |
| Router | `mikrotik_devices` | `routers` |
| Voucher | `transactions` (penjualan) + generate on-the-fly | `voucher_batches` + `vouchers` |
| Profil voucher | `hotspot_profiles` (role='voucher') | `voucher_packages` |
| Tiket | `tickets` | `tickets` |
| Registrasi calon pelanggan | `customer_registrations` | (via portal, masuk `customers`) |
| Counter dokumen | `sequence_counters` | *tidak ada* |
| Setting | `system_settings` (key-value, di DB) | `app_settings` (DB) **+ `settings.json`** (file) |
| Audit | `audit_logs` | audit via `auditTrailService` |
| Notifikasi | `notification_logs` + `message_templates` | template di `app_settings` |
| User staff | `users` (role: admin/operator/viewer) | `technicians`, `cashiers`, `collectors`, `agents`, admin (tabel terpisah per peran) |

**Tabel yang HANYA ada di billing-rtrw** (mencerminkan cakupan lebih luas):
`olts`, `odps` (infra PON & peta), `expenses`, `expense_categories`, `cash_in`
(akuntansi), `inventory_*` (gudang), `payroll_*`, `attendance` (HR/absensi),
`agents`, `agent_*`, `collectors`, `collector_payment_requests`, `cashiers`,
`public_voucher_orders`, `public_ppob_orders`, `digiflazz_*` (PPOB),
`genieacs_servers`, `customer_usage`, `webhook_payment_notifs`.

### 2.3 Perbedaan desain skema yang menonjol

1. **Subscription sebagai first-class entity (Rosmon)** — Rosmon memisahkan
   *siapa* (customer) dari *apa yang dilanggan* (subscription). Satu customer
   bisa punya banyak subscription. billing-rtrw menempelkan `pppoe_username`,
   `hotspot_username`, `package_id`, `isolir_profile`, `router_id` langsung di
   baris `customers` → satu pelanggan = satu layanan.

2. **Invoice line-item (Rosmon)** — Rosmon punya `invoice_items` terpisah;
   billing-rtrw hanya menyimpan `amount` agregat + kolom `notes` berisi metadata
   teks (mis. `"AUTO: Prorata 20/30 hari | PPN 11%"`).

3. **Pembayaran sebagai tabel tersendiri (Rosmon)** — Rosmon punya `payments`
   penuh (method, status pending/confirmed/rejected, idempotency key, field
   gateway, proof URL, confirmed_by). billing-rtrw **tidak punya tabel
   payment** — "lunas" diwakili dengan meng-update kolom di `invoices`
   (`status='paid'`, `paid_at`, `paid_by_name`). Jejak pembayaran online dicatat
   di tabel order (`public_voucher_orders`, `webhook_payment_notifs`).

4. **Idempotency & konsistensi (Rosmon)** — Rosmon menanam guard di tingkat DB:
   `UNIQUE(subscription_id, period_start)` mencegah invoice ganda,
   `IdempotencyKey` unik di payment, partial unique pada `payment_code`.
   billing-rtrw mencegah duplikat di tingkat aplikasi (query "ada belum?" lalu
   insert) di dalam transaksi.

5. **Enkripsi at-rest (Rosmon)** — `subscriptions.mikrotik_password` di-enkripsi
   AES-256-GCM (`store/crypto.go`); `portal_password_hash` bcrypt dan tidak
   pernah masuk DTO/log. billing-rtrw menyimpan `pppoe_password` plaintext di
   kolom customer (dipakai untuk re-create secret).

---

## 3. Pelanggan (Customers)

| Aspek | Rosmon | billing-rtrw |
|---|---|---|
| Identitas | `full_name`, `phone` (unik partial), `address`, `area`, `status` (aktif/nonaktif) | `name`, `phone`, `email`, `address`, `status` (active/suspended/...) |
| Hubungan ke layanan | via `subscriptions` (1:N) | atribut layanan inline di baris customer |
| Login portal | `portal_password_hash` (bcrypt) | login portal (OTP opsional) |
| Lokasi/GIS | — | `lat`/`lng`, peta Leaflet, jalur kabel polyline, ODP |
| Perangkat CPE | — | `genieacs_tag` → integrasi TR-069 (SSID/reboot) |
| Registrasi publik | `customer_registrations` (alur approve→install→provision oleh operator) | registrasi online langsung ke `customers` |
| Impor/ekspor | — | impor Excel, ekspor daftar |
| Soft delete | Ya (`deleted_at`, re-register diizinkan) | hapus langsung |

Rosmon punya **alur registrasi terstruktur** (`registration.go`,
`customer_registrations`): pengajuan publik → review admin → assign teknisi →
complete-install yang men-generate subscription + invoice pertama. billing-rtrw
lebih langsung: data pelanggan dibuat/diedit oleh admin/teknisi, atribut PPPoE
diisi manual.

---

## 4. Paket & Profil Layanan

- **Rosmon** memisahkan paket berdasarkan teknologi:
  - `ppp_profiles` — paket PPPoE, dengan `rate_limit`, `local/remote_address`,
    `parent_queue`, `price_monthly`, `is_public` (untuk form daftar publik).
    Nama profile = nama di `/ppp/profile` RouterOS.
  - `hotspot_profiles` — `role` membedakan `permanent` (pelanggan bulanan) vs
    `voucher` (berbasis expiry). Field voucher-only: `validity`, `expiry_mode`,
    `price`/`sell_price`, `lock_mac`. Nama = `/ip/hotspot/user/profile`.

  Profil DB ini disinkronkan dua arah dengan router (push & pull, lihat
  `workflows/sync_profiles.go` dan handler `ppp_profiles.go`/`hotspot_profiles.go`).

- **billing-rtrw** memakai satu tabel `packages` generik (`name`, `price`,
  `speed_down/up`, `description`) plus kolom tambahan untuk fitur lanjutan:
  `promo_price`/`promo_cycles`, `prorate_first_invoice`, `use_ppn`/`ppn_percentage`,
  `use_uso`/`uso_percentage`, `night_profile_name` (jam kalong), `fup_profile_name`
  (FUP). Nama paket diharapkan cocok dengan nama profile PPPoE di router. Voucher
  punya tabel sendiri `voucher_packages`.

**Catatan:** billing-rtrw memuat fitur tarif yang **belum ada** di Rosmon —
**promo siklus**, **prorata invoice pertama**, **PPN & USO** otomatis, **jam
kalong** (ganti profil malam/pagi via cron), dan **FUP** (turun profil saat
kuota bulanan terlampaui). Rosmon saat ini menghitung harga lurus dari
`price_monthly` profil.

---

## 5. Billing & Invoice

### 5.1 Model penagihan

| | **Rosmon** | **billing-rtrw** |
|---|---|---|
| Basis siklus | **Anniversary** — `subscriptions.next_invoice_date` (per langganan, berbasis `billing_day`) | **Kalender** — `period_month` + `period_year` (semua pelanggan ditagih untuk bulan yang sama) |
| Trigger generate | Cron harian (`job/billing_cron.go`) memindai subscription `active` yang `next_invoice_date == hari ini` | Cron `1 0 1 * *` (tgl 1 jam 00:01) generate massal semua customer; bisa manual per-customer |
| Nomor invoice | `INV-YYYY-MM-NNNN` dari `sequence_counters` (atomic `NextVal`) | tidak ada nomor formal; identitas = (`customer_id`, `period_month`, `period_year`) |
| Line-item | `invoice_items` terisi (deskripsi periode + harga) | hanya `amount` + `notes` teks |
| Status | `draft`/`issued`/`paid`/`overdue`/`cancelled` | `unpaid`/`paid` (+ implisit overdue lewat tanggal) |
| Idempotensi | `UNIQUE(subscription_id, period_start)` di DB | cek aplikasi: query existing sebelum insert, dalam `db.transaction` |
| Perhitungan harga | langsung dari `price_monthly` profil (`service/billing/service.go`) | `computeInvoiceAmountAndMeta`: promo + prorata + PPN + USO |
| Jatuh tempo | `due_date = period_start + billing.invoice_due_days` | tanggal isolir per-pelanggan (`isolate_day` / setting `isolir_day`) |

### 5.2 Alur generate invoice

**Rosmon** (`service/billing/service.go::GenerateForSubscription`):
1. Resolve nama profil + harga sesuai `service_type` (pppoe→ppp_profile,
   hotspot→hotspot_profile).
2. Ambil nomor urut dari `sequence_counters` (`INV`, tahun, bulan).
3. Hitung `period_end = period_start + 1 bulan - 1 hari`, `due_date`.
4. Buat invoice status `issued` + satu `invoice_item`, dengan `payment_code`
   unik (untuk settle-by-code/QR).
5. Cron lalu memajukan `next_invoice_date` +1 bulan (di-align ke `billing_day`,
   di-clamp 1–28) dan mengirim notifikasi `invoice_issued`.

Logika ini **dipakai bersama** oleh cron bulanan dan alur registrasi (invoice
pertama saat instalasi selesai) — satu sumber kebenaran.

**billing-rtrw** (`billingService.js::generateMonthlyInvoices`):
1. Ambil semua customer `active`/`suspended` yang punya `package_id`.
2. Skip yang sudah punya invoice untuk (bulan, tahun).
3. `computeInvoiceAmountAndMeta` menghitung amount (promo→prorata→PPN→USO) dan
   string `notes` AUTO.
4. Insert dalam satu `db.transaction`; bump `promo_cycles_used` bila promo
   dipakai. Ada juga `createInstallProrataCatchUpInvoice` untuk catch-up
   instalasi.

### 5.3 Pembayaran (mark-paid)

- **Rosmon**: pembayaran adalah entitas `payments`. Staff mencatat
  `cash`/`manual_transfer` (handler `payments.go`), bisa `confirm`/`reject`;
  ada **settle-by-code** (`POST /payments/collect`) untuk kasir scan QR/kode
  invoice. Saat payment `confirmed`, invoice di-set `paid` + emit audit log.
  Gateway Xendit lewat webhook (`webhook_xendit.go`).
- **billing-rtrw**: `markAsPaid(invoiceId, paidByName, notes)` hanya meng-update
  baris invoice (`status='paid'`, `paid_at`, `paid_by_name`) + audit trail.
  Tersedia bayar tunggal & **bayar massal** (`payInvoicesForCustomerMonths`),
  `markAsUnpaid` (batalkan pembayaran), dan integrasi gateway via tabel order +
  `webhook_payment_notifs` (cocokkan nominal unik QRIS → auto-paid).

---

## 6. Pembayaran Online / Gateway

| | Rosmon | billing-rtrw |
|---|---|---|
| Gateway didukung | **Xendit** (`service/payment/xendit.go`, adapter `gateway.go`) | **Midtrans, Tripay, Xendit, Duitku** (toggle di `settings.json`) |
| Inisiasi | `service.InitiatePayment(invoiceID, customerID)` → buat checkout URL, simpan ke `payments` (gateway fields) | per-portal, simpan `payment_link`/`payment_order_id`/`payment_reference` di tabel order |
| Webhook | `POST /public/webhooks/xendit` (proteksi `x-callback-token` + rate-limit per-IP) | webhook per-gateway + **webhook generik** `POST /api/webhook/v1/payment-notif` (`MY_WEBHOOK_SECRET`) — parse teks notifikasi bank/e-wallet, auto-paid bila nominal cocok |
| QRIS nominal unik | `payment_code` per invoice (QR di-render klien) | penugasan & pembersihan kode unik invoice, dicocokkan dari notifikasi |
| Kredensial gateway | di `system_settings` (`payment.*`) | di `settings.json` |

billing-rtrw juga punya **PPOB/Digiflazz** (jual pulsa/token via
`public_ppob_orders`, `digiflazz_*`) dan **portal agen** dengan saldo — domain
yang sama sekali di luar lingkup Rosmon.

---

## 7. Voucher Hotspot

| Aspek | Rosmon | billing-rtrw |
|---|---|---|
| Generate | `workflows/generate_vouchers.go` — random username/password dari charset, push tiap voucher ke `/ip/hotspot/user` via API, partial-fail aware (`GenerateVouchersErr` membawa yang sudah dibuat) | batch generate ke router; `voucher_batches` + `vouchers` mencatat tiap kode |
| Charset | `lower/upper/mixed/number/lower_number/upper_number/mixed_number` (domain `Charset`) | prefix + `code_length` |
| Mode | `user_mode`: `up` (user≠pass) / `vc` (password = username) | per `voucher_packages` |
| Expiry | comment format mikhmon `jan/02/2006 15:04:05` dari `validity` | `validity` di batch |
| Pencatatan jual | `transactions` (per penjualan: harga, profil, bulan untuk laporan) | status voucher `pending`→`used`, `last_seen_*` sinkron dari router |
| Penjualan publik | — | `public_voucher_orders` (beli voucher online, bayar gateway, kirim via WhatsApp), portal agen jual voucher + cetak struk |
| Cetak | print queue (frontend) + preset template | cetak batch, export CSV |
| Sumber profil | `hotspot_profiles` role=voucher (dari API router, **bukan hardcode**) | `voucher_packages` + profil dari router |

Rosmon mengeksekusi pembuatan voucher **langsung & sinkron** ke router pada saat
request (ini adalah operasi staff non-billing, bukan jalur outbox), dengan
penanganan partial-failure eksplisit. Penjualan dicatat ke `transactions`
(menggantikan penyimpanan di `/system/script` ala mikhmon). billing-rtrw
melacak siklus hidup voucher di DB (`vouchers.status`, `last_seen_*`) dan punya
**warmer cache** + alur jual publik/agen yang jauh lebih lengkap.

---

## 8. Hotspot & PPPoE Permanen

- **Rosmon** memodelkan layanan permanen sebagai `subscription` dengan
  `service_type` `pppoe` atau `hotspot`. `mikrotik_username` = join key ke
  `/ppp/secret` atau `/ip/hotspot/user`. Status langganan
  (`pending_install/active/isolir/suspended/terminated`) memetakan ke aksi
  router lewat outbox. Endpoint operasional read/command tersedia per device
  (`hotspot_*.go`, `ppp_*.go`): users, profiles, active sessions, hosts,
  bindings, cookies.

- **billing-rtrw** menyimpan `pppoe_username`/`pppoe_password`/`isolir_profile`
  langsung di customer, atau `hotspot_username`/`hotspot_password`/`hotspot_profile`,
  atau bahkan `connection_type='static'` dengan `static_ip` (queue statis).
  Operasi PPPoE/hotspot/static dipanggil langsung ke router
  (`mikrotikService.js`: `setPppoeProfile`, `createPppoeSecret`,
  `upsertHotspotUser`, `manageStaticIp`, `kickPppoeUser`).

billing-rtrw mendukung **3 tipe koneksi** (PPPoE, hotspot, static-IP) sedangkan
Rosmon fokus pada PPPoE + hotspot permanen.

---

## 9. Interaksi MikroTik & Provisioning — **Perbedaan Arsitektural Kunci**

Ini adalah perbedaan paling fundamental antara kedua sistem.

### 9.1 Rosmon — DB-first + Outbox (asynchronous, idempoten)

Setiap mutasi yang menyentuh router **tidak** dieksekusi langsung di HTTP
handler. Alurnya:

```
HTTP handler → tulis DB (subscription.sync_status = pending_*) → balas 200
                                  ↓ (terpisah)
        job/outbox.go (tiap 10 dtk) memindai sync_status != 'synced'
                                  ↓
        eksekusi perintah RouterOS via devmgr.ClientSet
                                  ↓
        sukses → sync_status='synced' ; gagal → IncrSyncRetry,
        setelah 5x → status 'error' + escalate notifikasi ke admin
```

Status sync → aksi router (`outbox.go::applySync`):

| `sync_status` | Aksi RouterOS |
|---|---|
| `pending_create` | `SecretAdd` (PPPoE) / `UserAdd` (hotspot), profil normal, disabled=no |
| `pending_profile_change` | set profile → normal **atau** `isolir` (dari `billing.isolir_profile_name`) |
| `pending_disable` | `SecretSetDisabled(true)` / `UserSetDisabled(true)` |
| `pending_enable` | restore profil normal + disable(false) |
| `pending_delete` | `SecretRemove` / `UserRemove` |

Sifat penting:
- **Idempoten** — `ErrNotFound` saat target sudah hilang diperlakukan sukses.
- **Tahan router offline** — jika device tak terjangkau, retry tick berikutnya;
  DB tetap konsisten.
- **Timeout per operasi** 10 dtk, batch 20, escalation threshold 5.
- DB selalu jadi **sumber kebenaran**; router adalah replika yang
  direkonsiliasi. Ada pula `job/reconciler.go`.

### 9.2 billing-rtrw — Panggilan langsung (synchronous)

Mutasi router dipanggil **inline** di dalam fungsi service, pada saat request
atau cron berjalan. Contoh `customerService.js::suspendCustomer`:

```js
updateCustomer(id, { ...customer, status: 'suspended' });   // tulis DB
// lalu LANGSUNG ke router:
await mikrotikSvc.setPppoeProfile(customer.pppoe_username, isolirProfile, customer.router_id);
await mikrotikSvc.ensurePppProfileIsolirAddressListHook(isolirProfile, customer.router_id);
// (static) manageStaticIp({ isolate:true })
// (hotspot) setHotspotUserDisabled(username, true)
```

Sifat:
- Sederhana & langsung terlihat hasilnya, tetapi **tidak ada antrian/rekonsiliasi**.
- Jika router **offline** atau API gagal saat itu, DB sudah berubah tetapi
  router belum — bisa terjadi **drift** state DB vs router (perlu intervensi
  manual / retry tak terjamin).
- Koneksi via `routeros-client` (per `router_id`); mendukung multi-router,
  setup firewall isolir, hook address-list, generate script portal isolir.

### 9.3 Implikasi

| | Rosmon (outbox) | billing-rtrw (langsung) |
|---|---|---|
| Konsistensi DB↔router | Eventual, terjamin via retry | Best-effort, rawan drift saat router down |
| Latensi respons user | Cepat (200 segera, sync di belakang) | Menunggu round-trip router |
| Kompleksitas | Lebih tinggi (outbox, retry, escalation) | Rendah (panggil langsung) |
| Observability kegagalan | `sync_status='error'` + notifikasi admin | bergantung log; bisa silent |
| Cocok untuk | Skala, reliabilitas | Cepat dibangun, instalasi kecil |

---

## 10. Isolir / Suspensi (Penagihan → Pemutusan)

**Rosmon** (`job/suspension_check.go`, harian 09:00):
1. Reminder H-2 untuk invoice `issued` yang jatuh tempo 2 hari lagi.
2. Tandai `overdue` invoice yang lewat due_date.
3. **Isolir** subscription `active` dengan tunggakan ≥ `billing.isolir_after_days`
   → set status `isolir` + `sync_status='pending_profile_change'` (outbox yang
   ganti profil ke isolir).
4. **Hard suspend** ≥ `billing.hard_suspend_after_days` → status `suspended` +
   `sync_status='pending_disable'`.

Semua perubahan **hanya ke DB**; eksekusi ke router dilakukan outbox. Tiga
tingkat: aktif → isolir (throttle) → suspended (disable keras).

**billing-rtrw** (`cronService.js`):
- Cron harian `0 2 * * *` memindai pelanggan dengan `auto_isolate` aktif yang
  `isolate_day`-nya = hari ini → `customerSvc.suspendCustomer()` yang **langsung**
  set profil isolir di router.
- Cron `0 9` kirim reminder WhatsApp sebelum tanggal isolir.
- Bonus cron: **jam kalong** (`0 0` ganti ke `night_profile_name`, `0 6` balik),
  **FUP** (tiap jam cek pemakaian, turun ke `fup_profile_name`).

Perbedaan: Rosmon memisahkan **keputusan** (cron, ke DB) dari **eksekusi**
(outbox, ke router) dan punya dua tingkat (isolir vs suspend). billing-rtrw
menggabungkan keputusan+eksekusi dalam satu cron sinkron, plus fitur jam-kalong
& FUP yang belum ada di Rosmon.

---

## 11. Notifikasi & Komunikasi

| | Rosmon | billing-rtrw |
|---|---|---|
| WhatsApp | whatsmeow (embedded), `service/notification` | Baileys (`whatsappBot.mjs`), broadcast, antrian |
| Telegram | abstraksi notifikasi | `telegramBot.js` (bot admin) |
| Template | `message_templates` (DB) + `notification_logs` + retry job | template di `app_settings`, placeholder `{{nama}}` dll |
| Pemicu | invoice_issued, invoice_reminder, invoice_overdue, service_isolir, service_suspended, outbox_escalation | reminder tagihan, isolir, broadcast manual |
| Pola | best-effort async (`NotifyAsync`), retry via `job/notif_retry.go` | inline pada aksi, dengan variasi pesan & backoff |

---

## 12. Fitur Eksklusif per Sisi

**Hanya Rosmon:**
- Pola outbox + reconciler (konsistensi DB↔router).
- Subscription sebagai entitas + line-item invoice + nomor invoice formal.
- Tabel `payments` penuh dengan status & idempotency, settle-by-code.
- Enkripsi password layanan at-rest (AES-GCM), partial unique index Postgres.
- SPA React modern terpisah; SSE hub untuk realtime; OpenAPI bundle.
- RBAC tiga peran (admin/operator/viewer) di satu tabel users.

**Hanya billing-rtrw:**
- **GenieACS/TR-069** (kelola SSID/Wi-Fi password/reboot CPE, bulk).
- **OLT PON via SNMP** (statistik ONU, reboot/rename/authorize ONU).
- **GIS/Peta** (Leaflet, marker pelanggan/ODP, jalur kabel, rute).
- **Inventaris/gudang**, **payroll & absensi**, **akuntansi** (expenses/cash_in).
- **Portal multi-peran**: agen (saldo, jual voucher), kasir, kolektor (tagih
  lapangan + approval).
- **PPOB/Digiflazz** (jual pulsa/token).
- **4 gateway pembayaran** + webhook generik teks bank.
- Tarif lanjutan: promo siklus, prorata, PPN/USO, **jam kalong**, **FUP**,
  koneksi **static-IP**.

---

## 13. Tabel Ringkasan Perbedaan Teknis

| Dimensi | Rosmon | billing-rtrw |
|---|---|---|
| Konsistensi router | Kuat (outbox idempoten) | Lemah (langsung, rawan drift) |
| Model data billing | Subscription + invoice_items + payments | Customer + invoices (paid flag) |
| Siklus tagih | Anniversary per-langganan | Kalender bulan/tahun |
| Penomoran invoice | Formal (sequence) | Tidak ada |
| Tarif | Harga lurus | Promo/prorata/PPN/USO/FUP/jam kalong |
| DB | PostgreSQL + ORM + migrasi auto | SQLite + SQL mentah |
| Keamanan kredensial | Enkripsi at-rest | Plaintext password |
| Cakupan fungsional | Fokus billing+MikroTik | Suite ISP penuh (TR-069/OLT/GIS/HR/PPOB) |
| Frontend | SPA React terpisah | EJS server-rendered |
| Gateway | Xendit | Midtrans/Tripay/Xendit/Duitku + generik |
| Testabilitas | Tinggi (service murni, `NowFunc`, fakes) | Sedang (service akses `db` global) |

---

## 14. Kesimpulan

**Rosmon** dan **billing-rtrw** menyelesaikan masalah yang tumpang tindih
(billing ISP + kontrol MikroTik) dengan filosofi berbeda:

- **Rosmon** unggul dalam **kebenaran & keandalan rekayasa**: pemisahan lapisan
  tegas (handler/service/store), pola **outbox** yang menjamin DB↔router
  konsisten meski router offline, model billing yang rapi (subscription, invoice
  ber-line-item & bernomor, payments dengan status & idempotency), serta
  keamanan (enkripsi at-rest, RBAC). Cocok sebagai fondasi yang skalabel dan
  mudah diuji, namun cakupan fiturnya masih fokus pada inti billing+jaringan
  MikroTik.

- **billing-rtrw** unggul dalam **keluasan fitur**: ia adalah platform ISP
  lengkap (TR-069/GenieACS, OLT/SNMP, peta GIS, inventaris, payroll, multi-portal
  agen/kasir/kolektor, PPOB, 4 gateway, tarif lanjutan promo/prorata/PPN/FUP).
  Namun arsitekturnya **memanggil MikroTik secara sinkron langsung** tanpa
  lapisan rekonsiliasi, menyimpan kredensial plaintext, dan tidak memodelkan
  pembayaran/subscription sebagai entitas tersendiri — sehingga lebih rawan
  drift state dan lebih sulit di-scale/uji.

**Peluang adopsi untuk Rosmon** (fitur matang di billing-rtrw yang belum ada):
tarif lanjutan (**prorata invoice pertama, promo siklus, PPN/USO**), **jam
kalong & FUP**, **koneksi static-IP**, **multi-gateway + webhook generik**, dan
modul di luar billing (TR-069, OLT/SNMP, GIS) bila roadmap mengarah ke suite
penuh.

**Kekuatan Rosmon yang patut dipertahankan** dan layak dicontoh oleh sistem
sejenis: **pola outbox/reconciler**, **subscription+invoice+payment yang
ternormalisasi dengan idempotency di DB**, dan **enkripsi kredensial at-rest**.
