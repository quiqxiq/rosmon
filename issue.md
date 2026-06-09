# Issue: Auto-generate Portal Password & Kirim ke Customer via Notifikasi

## Status Existing (Wajib Dibaca Sebelum Implementasi)

Sebelum mulai, pahami apa yang **sudah ada** agar tidak mengimplementasi ulang:

| Komponen | Status |
|---|---|
| Kolom `portal_password_hash` di tabel `customers` | ✅ Sudah ada (`store/model/customer.go:25`) |
| Service `ChangePassword` (customer ganti password sendiri) | ✅ Sudah ada (`service/portal/auth.go:75`) |
| Endpoint `POST /customer/change-password` | ✅ Sudah ada (`api/handler/customer_portal.go:239`) |
| Halaman "Ganti Password" di customer portal | ✅ Sudah ada (`web/src/features/customer-portal/profile/index.tsx:133`) |
| Service `SetPassword` (admin set password manual) | ✅ Sudah ada (`service/portal/auth.go:61`) |
| Endpoint admin `POST /customers/:id/portal-password` | ✅ Sudah ada (`api/handler/customers.go:53`) |

**Yang belum ada (target issue ini):**
1. Password di-generate **otomatis** saat customer dibuat (sekarang manual via admin)
2. Kredensial portal (username + password) **dikirim ke customer** lewat notifikasi WhatsApp
3. System setting `portal.url` untuk link portal di template notifikasi

---

## Gambaran Umum Fitur

Saat ini, admin harus secara manual memanggil endpoint `POST /customers/:id/portal-password`
untuk memberi akses portal ke customer. Customer tidak pernah diberitahu kredensialnya.

Target: password portal di-generate otomatis saat customer dibuat, lalu dikirim ke nomor
WhatsApp customer lewat notifikasi `portal_welcome` yang menyertakan username, password
plain text, dan link portal.

---

## Perubahan Skema Database

### 1. Tidak ada perubahan kolom

Kolom `portal_password_hash` sudah ada di model `Customer`. **Tidak perlu migrasi baru.**

### 2. Tambah system setting `portal.url`

Di `store/seed_settings.go` (atau tempat seed system settings), tambahkan baris:

```
key: "portal.url"
value: "http://localhost:5173/portal"   ← default dev
group: "general"
description: "URL customer portal (dipakai di notifikasi)"
```

Lihat pola seed yang sudah ada di file tersebut sebagai referensi format.

### 3. Tambah template notifikasi `portal_welcome`

Di `store/seed_templates.go`, tambahkan entry baru di slice `defaults`:

```
Slug: "portal_welcome"
Name: "Selamat Datang di Portal"
Variables: ["customer_name", "company_name", "portal_username", "portal_password", "portal_url"]
Body: (lihat bagian API di bawah untuk isi body)
```

Template ini bersifat `FirstOrCreate` (idempotent), sama seperti template lain di file itu.

---

## Perubahan API

### 1. Tambah method `GeneratePassword` di service portal

**File:** `service/portal/auth.go`

Tambahkan method baru di struct `CustomerAuth`:

```
func (a *CustomerAuth) GenerateAndSetPassword(ctx, customerID) (plainPassword string, err error)
```

Logika:
- Generate random string 10 karakter, human-readable (kombinasi huruf + angka + 1 simbol)
- Contoh output: `Net@2024abc`, `Sky#7mango`
- Hash dengan bcrypt via `a.d.Hasher.Hash(plain)`
- Update `customer.PortalPasswordHash` via `a.d.Customers.Update`
- Return plain password (untuk dikirim ke notifikasi)

Untuk generate string acak, gunakan `crypto/rand` (bukan `math/rand`). Contoh charset:
`abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789@#!`
(hindari karakter mirip: 0/O, 1/I/l).

### 2. Update handler `Create` customer

**File:** `api/handler/customers.go` — method `Create` (baris 128)

Setelah `h.Store.Create(c.Request.Context(), cust)` berhasil:
1. Panggil `h.PortalAuth.GenerateAndSetPassword(ctx, cust.ID)` → dapat `plainPassword`
2. Panggil `h.Notification.NotifyAsync(...)` dengan slug `portal_welcome` dan vars:
   - `portal_username` = `cust.Phone` (nomor HP sebagai username login)
   - `portal_password` = `plainPassword`
   - `portal_url` = ambil dari setting `portal.url` via `h.Settings.Get(ctx, "portal.url")`
   - `customer_name` = `cust.FullName`
   - `company_name` = dari setting `general.company_name`
3. Jika `h.PortalAuth == nil` atau `h.Notification == nil`, skip langkah 1-2 (nil-safe)

Tambahkan dependency `Notification *notification.Service` dan `Settings store.SettingStore`
ke struct `Customers` (di `customers.go:21`). Wire-up di `api/routes.go` tempat
`NewCustomers` dipanggil (baris 218).

**Catatan:** Jangan return error jika generate password atau notifikasi gagal.
Log warning, tapi tetap return `201 Created`. Customer bisa tetap dibuat meski notif gagal.

### 3. Update template `installation_complete`

**File:** `store/seed_templates.go` (baris 29-32)

Template ini sudah punya var `{{.username}}` dan `{{.password}}` yang berisi
kredensial MikroTik. Tambahkan baris portal di body-nya:

```
Body: "Halo {{.customer_name}}, layanan internet Anda sudah aktif! 🎉\n
Username: {{.username}}\nPassword: {{.password}}\n\n
🌐 Portal pelanggan: {{.portal_url}}\nLogin dengan nomor HP Anda.\n\n
Selamat menikmati layanan {{.company_name}}."
```

Dan update `Variables` JSON-nya dengan tambahan `"portal_url"`.

Di `api/handler/registration.go` method `notifyCustomer` (baris 417-422),
tambahkan `"portal_url"` ke map vars yang dikirim saat `installation_complete`.
Ambil nilai dari `h.setting(ctx, "portal.url", "")`.

> Template ini menggunakan `FirstOrCreate` — artinya seed hanya berjalan
> untuk row baru. Untuk update body template yang sudah ada di DB,
> perlu migrasi data manual atau update via admin UI (`PUT /message-templates/:id`).

---

## Perubahan Frontend

**Tidak ada perubahan frontend yang dibutuhkan.**

Halaman "Ganti Password" di customer portal (`/portal/profile`) sudah sepenuhnya
diimplementasi dan berfungsi. Jangan modifikasi file tersebut.

---

## Tahapan Implementasi

### Tahap 1 — Backend: Generate Password + System Setting

**File yang disentuh:**
- `store/seed_settings.go` → tambah `portal.url`
- `store/seed_templates.go` → tambah template `portal_welcome` + update `installation_complete`
- `service/portal/auth.go` → tambah method `GenerateAndSetPassword`

**Urutan:**
1. Buka `store/seed_settings.go`, tambah entry `portal.url`
2. Buka `store/seed_templates.go`, tambah template `portal_welcome` di slice `defaults`
3. Update body template `installation_complete` di slice yang sama
4. Di `service/portal/auth.go`, tambah method `GenerateAndSetPassword` di bawah `SetPassword`
5. Jalankan `make test` untuk verifikasi tidak ada yang broken

**Done criteria Tahap 1:**
- [ ] `make build` tidak error
- [ ] `make test` lulus
- [ ] Method `GenerateAndSetPassword` bisa dipanggil di unit test dengan customer ID valid
- [ ] Template `portal_welcome` muncul di tabel `message_template` setelah `Migrate()` dipanggil

---

### Tahap 2 — Backend: Wire ke Handler Create Customer

**File yang disentuh:**
- `api/handler/customers.go` → update struct + method `Create`
- `api/routes.go` → wire dependency baru

**Urutan:**
1. Di `customers.go`, tambah field `Notification` dan `Settings` ke struct `Customers`
2. Update method `Create` untuk memanggil `GenerateAndSetPassword` + `NotifyAsync`
3. Di `api/routes.go` sekitar baris 218, inject `deps.NotificationService` dan `deps.SettingStore`
   ke handler `Customers` yang sudah dibuat
4. Jalankan `make build` untuk pastikan compile

**Done criteria Tahap 2:**
- [ ] `make build` tidak error
- [ ] Saat `POST /customers` dipanggil, customer baru langsung punya `portal_password_hash` terisi
- [ ] `notification_log` berisi entry baru dengan `template_slug = 'portal_welcome'` (bisa dicek via DB)
- [ ] Jika `notification.wa_enabled = false`, notif ter-log sebagai `skipped` (bukan error)

---

### Tahap 3 — Manual Test End-to-End

1. Jalankan stack: `make dev`
2. Buat customer baru via UI admin (halaman `/customers`)
3. Cek tabel `customers` di DB: kolom `portal_password_hash` harus terisi
4. Cek tabel `notification_log`: harus ada entry dengan `template_slug = 'portal_welcome'`
5. Login ke customer portal (`/portal/login`) dengan nomor HP dan password dari log notifikasi
6. Pastikan login berhasil
7. Buka `/portal/profile` → klik "Ganti Password" → ubah password → login ulang dengan password baru

---

## Referensi File Penting

| File | Kegunaan |
|---|---|
| `store/model/customer.go` | Model Customer (lihat field `PortalPasswordHash`) |
| `service/portal/auth.go` | Service auth customer portal — tambah method di sini |
| `store/seed_templates.go` | Seed template notifikasi — tambah `portal_welcome` di sini |
| `store/seed_settings.go` | Seed system settings — tambah `portal.url` di sini |
| `api/handler/customers.go` | Handler CRUD customer — update method `Create` di sini |
| `api/handler/registration.go:417` | Tempat `installation_complete` dikirim |
| `api/routes.go:218` | Tempat wiring handler `Customers` |
| `service/notification/service.go` | Cara pakai `NotifyAsync` |
| `job/notify_helpers.go` | Contoh pola pemanggilan `NotifyAsync` |

---

## Catatan Keamanan

- **Jangan pernah log atau return `portal_password_hash` di DTO/response** — sudah ada aturan ini di `CLAUDE.md`
- Plain password (`plainPassword`) hanya boleh dipakai satu kali (langsung di-pass ke `NotifyAsync`), tidak boleh disimpan ke DB atau di-log
- Jika `GenerateAndSetPassword` gagal, jangan block pembuatan customer — log error dan lanjut
