# roadmap.md — Rencana Pengembangan Bertahap Rosmon

> Roadmap implementasi Rosmon, disusun dari kondisi nyata codebase
> (branch `feat/backend-integration`, per 2026-05-30) dan visi di
> [`goal.md`](goal.md). Urutan fase ditentukan oleh **dependensi teknis
> yang terverifikasi di kode**, bukan urutan fitur di permintaan.
>
> Legenda status: ✅ sudah ada · 🟡 sebagian · ⬜ belum ada
> Estimasi = developer tunggal, kasar (kalender, bukan jam murni).

---

## Peta Dependensi (kenapa urutannya begini)

```
                 ┌─────────────────────────────────────────────┐
                 │  SUDAH ADA (fondasi tidak perlu dibangun)    │
                 │  outbox ✅  billing_cron ✅  suspension ✅    │
                 │  subscription/customer/invoice/payment CRUD ✅│
                 │  auth staff ✅  device mgr ✅  settings ✅     │
                 └───────────────────┬─────────────────────────┘
                                     │
   FASE 0  Audit log + Message templates + Notification logs (model dasar)
                                     │
   FASE 1  ▶ service/notification + WhatsApp (whatsmeow)  ◀ LINCHPIN
                                     │
        ┌────────────────────────────┼───────────────────────────┐
        │                            │                            │
   FASE 2                       FASE 3                        (paralel)
   Registrasi                  CustomerClaims                 FASE 5
   (publik+admin)              + Customer Portal              Landing Page
        │                            │
        │                       FASE 4
        │                       Payment Gateway
        └────────────────────────────┴───────────────────────────┐
                                                                   │
                                                              FASE 6
                                                       Hardening & Ops
```

**Aturan rantai kritis:**

1. **Notifikasi (Fase 1) adalah prasyarat** untuk registrasi, isolir
   ber-notif, portal OTP, dan konfirmasi pembayaran. Karena itu didahulukan
   tepat setelah model pendukungnya (Fase 0).
2. **`CustomerClaims` (Fase 3) adalah prasyarat** customer portal.
3. **Payment gateway (Fase 4) butuh portal** (Fase 3) sebagai tempat customer
   membayar, dan butuh notifikasi (Fase 1) untuk konfirmasi.
4. **Provisioning ke router sudah lewat outbox** — registrasi & aktivasi
   (Fase 2) tidak perlu menulis ulang integrasi MikroTik.

---

## FASE 0 — Fondasi Data yang Hilang

**Tujuan:** lengkapi model dasar yang dirujuk konvensi tapi belum ada,
sehingga fase berikutnya tidak terblokir.

| Task | Status | Catatan |
|---|---|---|
| `store/errors.go` (sentinel `ErrNotFound`/`ErrDuplicate`/`ErrConstraint`) | 🟡 | AGENTS.md mengharapkannya; konfirmasi & sentralisasi |
| `model.AuditLog` + `store/audit_log_store.go` + helper `audit.Log()` | ⬜ | Diwajibkan AGENTS.md untuk aksi ubah-status |
| `model.MessageTemplate` + `store/template_store.go` + seed slug di `migrate.go` | ⬜ | Slug: invoice_issued, invoice_reminder, service_isolir, registration_*, payment_*, installation_complete |
| `model.NotificationLog` + `store/notification_log_store.go` | ⬜ | Index `(status, next_retry_at)` untuk retry |
| Update `store/migrate.go` (3 model baru) | ⬜ | Wajib satu commit dengan model |
| Handler admin `message-templates` (GET/PUT per slug) | ⬜ | Agar template bisa diedit tanpa redeploy |

**Prioritas:** tertinggi — murni prasyarat, risiko rendah, tanpa dependensi
eksternal. **Estimasi: ~1 minggu.**

---

## FASE 1 — Service Notifikasi + WhatsApp (whatsmeow) 🎯 LINCHPIN

**Tujuan:** satu jalur notifikasi terpusat; semua fitur lain memakainya.

| Task | Status | Catatan |
|---|---|---|
| `service/notification` + interface `Sender` | ⬜ | `Send(ctx, phone, message) error` |
| `WhatsmeowSender` (klien embedded + persist sesi) | ⬜ | Sesi disimpan persisten (sqlstore/DB); satu binary, tanpa gateway eksternal |
| Endpoint admin QR + status koneksi WA | ⬜ | `GET /api/v1/whatsapp/qr`, status via SSE (hub sudah ada) |
| Render template (`text/template`, var `{{.Field}}`) | ⬜ | Sumber dari `message_templates` (Fase 0) |
| `Notify` / `NotifyAsync` + tulis `notification_logs` selalu | ⬜ | Gagal kirim → status `failed` + `next_retry_at` |
| `job/notif_retry.go` (tiap ~5 menit) | ⬜ | Retry kiriman gagal, idempotent |
| Baca toggle `notification.wa_enabled` dari settings | ✅(seed)/⬜(kode) | Setting sudah ter-seed; kode pembacanya belum ada |
| **Wiring** notifikasi ke job existing | ⬜ | `billing_cron` → invoice_issued; `suspension_check` → reminder/isolir/suspended |

**Prioritas:** kritis & paling berdampak. Mengubah job yang sudah jalan jadi
"berbicara" ke pelanggan. **Estimasi: ~2–3 minggu** (whatsmeow + QR + sesi
persisten adalah bagian terberat).

**Risiko:** pairing/relogin WhatsApp, ban nomor karena broadcast agresif —
mitigasi dengan antrian + jeda kirim.

---

## FASE 2 — Registrasi Pemasangan (Publik + Admin) 🎯

**Tujuan:** alur calon pelanggan → antrian admin → instalasi → aktivasi.

| Task | Status | Catatan |
|---|---|---|
| Zone route **publik** pertama di `api/routes.go` | ⬜ | Pakai per-IP limiter yang sudah ada (anti-spam) |
| `model.CustomerRegistration` + store + `migrate.go` | ⬜ | status pending/approved/rejected/cancelled, jadwal, petugas |
| `POST /api/public/registrations` | ⬜ | + notif `registration_received` ke admin (Fase 1) |
| `GET /registrations`, approve/reject/assign | ⬜ | approve → buat `Customer` + notif `registration_approved` (jadwal) |
| `POST /registrations/:id/complete-install` (operator) | ⬜ | Buat `Subscription` (SyncStatus=`pending_create`) → **outbox provision (sudah ada)** + invoice pertama + notif `installation_complete` |
| Frontend modul `web/src/features/registrations/` | ⬜ | Antrian + aksi approve/tolak/jadwal |

**Prioritas:** tinggi — pintu masuk pelanggan baru. **Reuse besar:**
provisioning router & generate invoice sudah ada. **Estimasi: ~2 minggu.**

---

## FASE 3 — Customer Auth Scope + Portal 🎯

**Tujuan:** pelanggan login & self-service.

| Task | Status | Catatan |
|---|---|---|
| `auth.CustomerClaims` + `SignCustomerAccess` | ⬜ | Scope terpisah dari `auth.Claims` staff |
| `middleware.RequireCustomerAuth(signer)` | ⬜ | Zone route customer baru |
| `Customer.portal_password_hash` (migrasi) | ⬜ | Null = login via OTP saja |
| Login OTP WhatsApp (`/api/public/customer/auth/otp/*`) | ⬜ | **Butuh Fase 1**; simpan OTP TTL 5 mnt (DB/Redis) |
| `/api/customer/*` (me, subscription, status live, invoices, pay, payments) | ⬜ | `status` boleh read live ke MikroTik (read = diizinkan) |
| Frontend `web/src/features/customer-portal/` + login terpisah | ⬜ | Dashboard layanan, tagihan, histori, profil, ajukan ganti paket |

**Prioritas:** tinggi, tapi **setelah** notifikasi (OTP butuh WA).
**Estimasi: ~3 minggu** (backend scope + frontend portal).

---

## FASE 4 — Payment Gateway (Xendit & Tripay) 🎯

**Tujuan:** pembayaran online otomatis dari portal.

| Task | Status | Catatan |
|---|---|---|
| Extend `model.Payment` (`external_ref`, `gateway_response`, method baru) | ⬜ | `IdempotencyKey` sudah ada di model |
| `service/payment` + interface gateway + adapter Xendit/Tripay | ⬜ | Buat invoice/charge, verifikasi signature |
| Endpoint webhook publik + verifikasi signature | ⬜ | Idempotent; cocokkan ke invoice |
| Trigger restore otomatis pasca-bayar | ✅(jalur)/⬜(sambung) | Reuse `pending_enable`/`pending_profile_change` → outbox (sudah ada) |
| Notif `payment_confirmed`/`payment_rejected` | ⬜ | Butuh Fase 1 |
| Frontend: pilih metode bayar di portal | ⬜ | Butuh Fase 3 |

**Prioritas:** tinggi tapi **paling akhir di rantai pelanggan** (butuh portal
+ notifikasi). **Estimasi: ~2–3 minggu** (testing webhook & sandbox provider).

---

## FASE 5 — Landing Page Publik (Paralel)

**Tujuan:** halaman pemasaran + pintu ke registrasi.

| Task | Status | Catatan |
|---|---|---|
| Endpoint publik read-only (daftar paket aktif, info perusahaan) | ⬜ | `general.company_name` sudah di settings |
| Halaman landing (paket, harga, area, kontak) | ⬜ | CTA → form registrasi (Fase 2) |
| Halaman info statis (S&K, privasi, tentang) | ⬜ | Inspirasi billing-rtrw |

**Prioritas:** sedang — bernilai pemasaran, **dependensi teknis ringan**, bisa
dikerjakan **paralel** kapan saja setelah Fase 2 (form daftar). **Estimasi:
~1 minggu.**

---

## FASE 6 — Hardening, Ops & Utang Teknis

**Tujuan:** ketahanan operasional & kualitas jangka panjang.

| Task | Status | Justifikasi |
|---|---|---|
| `job/reconciler.go` (drift DB↔router, per jam) | ⬜ | DB-first → drift dari perubahan manual di Winbox harus terdeteksi |
| Eskalasi outbox gagal >5x → notif admin | 🟡 | `outbox.go` baru menandai `error`, belum eskalasi/notif |
| Ekstrak logika ke `service/{subscription,billing}` | 🟡 | Handler `subscriptions.go` ~21KB; sesuaikan dengan AGENTS.md (utang teknis, bukan blocker) |
| Audit log ter-wire di semua aksi ubah-status | ⬜ | Setelah helper Fase 0 ada |
| Laporan keuangan & analitik (pendapatan, aging, churn) | 🟡 | Data invoices/payments sudah ada; tinggal agregasi + UI |
| Reminder H-2 sebelum jatuh tempo | ⬜ | Lengkapi `suspension_check` (butuh Fase 1) |
| Backup config router + dump DB terjadwal | ⬜ | Kebutuhan ops standar |
| Ekspansi role (kasir/teknisi) | 🟡 | Operasi lapangan & kasir butuh peran terpisah |
| Tiket dukungan (trouble ticket) | ⬜ | Melengkapi customer portal |
| Kanal notifikasi Telegram (impl `Sender` kedua) | ⬜ | Tanpa ubah pemanggil — interface sudah dirancang Fase 1 |
| Halaman monitoring router & health + alert | 🟡 | Sebagian via Influx; tambah health + ambang alert |

**Prioritas:** menyusul, banyak yang **parallelizable**. **Estimasi: ~3–4
minggu** tersebar (bukan blok tunggal).

---

## Ringkasan Estimasi & Total

| Fase | Fokus | Estimasi | Blocking? |
|---|---|---|---|
| 0 | Model fondasi (audit/template/notif log) | ~1 mg | ya (untuk 1) |
| 1 | Notifikasi + WhatsApp (whatsmeow) | ~2–3 mg | **ya (linchpin)** |
| 2 | Registrasi (publik+admin) | ~2 mg | sebagian |
| 3 | Customer auth + portal | ~3 mg | ya (untuk 4) |
| 4 | Payment gateway | ~2–3 mg | tidak |
| 5 | Landing page | ~1 mg | tidak (paralel) |
| 6 | Hardening & ops | ~3–4 mg (tersebar) | tidak |

**Total kasar: ~14–17 minggu** developer tunggal untuk Fase 0–5; Fase 6
berjalan inkremental berbarengan.

---

## Rekomendasi Prioritas (jika sumber daya terbatas)

Bila harus memilih jalur minimum bernilai tertinggi lebih dulu:

1. **Fase 0 → Fase 1** (notifikasi). Ini mengaktifkan nilai yang sudah
   terkubur: billing & suspensi yang *sudah jalan* langsung jadi terlihat
   oleh pelanggan via WhatsApp. ROI tertinggi per minggu.
2. **Fase 2** (registrasi). Menambah pelanggan baru tanpa proses manual,
   me-reuse outbox & billing yang sudah ada.
3. **Fase 3 → Fase 4** (portal + payment). Menutup loop self-service:
   pelanggan bayar sendiri, layanan pulih otomatis.
4. **Fase 5 & 6** menyusul/paralel sesuai kapasitas.

> Catatan: Fase 6 ("ekstrak ke `service/`", "eskalasi outbox", "audit log
> wiring") sebaiknya **dicicil di dalam fase terkait** alih-alih ditunda ke
> akhir, agar utang teknis tidak menumpuk — terutama karena AGENTS.md
> menjadikan audit log & pemisahan service sebagai aturan wajib PR.
