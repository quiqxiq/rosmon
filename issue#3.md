# Issue #3: Sistem Invoice & Billing

## Status Aktual Codebase (Wajib Dibaca Dulu)

Sebagian besar fitur ini **sudah diimplementasi**. Jangan menulis ulang yang sudah ada.
Baca tabel ini sebelum mulai coding.

### Backend — Sudah Ada

| Komponen | File | Status |
|---|---|---|
| Model `Invoice` (DB schema) | `store/model/invoice.go` | ✅ Lengkap |
| `InvoiceStore` + migrasi | `store/invoice_store.go`, `store/migrate.go` | ✅ Lengkap |
| `GET /invoices` (filter status, customer_id) | `api/handler/invoices.go:50` | ✅ Ada, filter bulan belum |
| `GET /invoices/:id` | `api/handler/invoices.go:76` | ✅ Lengkap |
| `POST /invoices/generate` (manual) | `api/handler/invoices.go:98` | ✅ Lengkap |
| `POST /invoices/:id/cancel` | `api/handler/invoices.go:161` | ✅ Lengkap |
| `GET /customer/invoices` (portal) | `api/handler/customer_portal.go:126` | ✅ Lengkap |
| `GET /customer/invoices/:id` (portal) | `api/handler/customer_portal.go:146` | ✅ Lengkap |
| Auto-generate invoice bulanan (cron) | `job/billing_cron.go` | ✅ Lengkap |
| Auto-mark overdue + notifikasi | `job/suspension_check.go:57` | ✅ Lengkap |
| DTO `InvoiceResponse` + mapper | `api/dto/invoice.go` | ✅ Lengkap |

### Frontend Admin — Sudah Ada

| Komponen | File | Status |
|---|---|---|
| Halaman list invoice | `web/src/features/invoices/index.tsx` | ✅ Lengkap |
| Tabel kolom: no. invoice, pelanggan, jumlah, periode, jatuh tempo, status, aksi | `web/src/features/invoices/components/columns.tsx` | ✅ Lengkap |
| Filter status (Belum Bayar, Terlambat, Lunas, dll) | `web/src/features/invoices/index.tsx` | ✅ Lengkap |
| Search pelanggan (text) | `web/src/features/invoices/index.tsx` | ✅ Ada, client-side |
| Dialog detail invoice + riwayat pembayaran | `web/src/features/invoices/components/invoice-detail-dialog.tsx` | ✅ Lengkap |
| Tombol batalkan invoice di detail | `web/src/features/invoices/components/invoice-detail-dialog.tsx` | ✅ Lengkap |
| Dialog generate invoice manual | `web/src/features/invoices/components/generate-invoice-dialog.tsx` | ✅ Lengkap |
| Status badge (Draft/Belum Bayar/Lunas/Terlambat/Dibatalkan) | `web/src/features/invoices/components/invoice-status-badge.tsx` | ✅ Lengkap |
| Route `/invoices` + sidebar link | `web/src/routes/_authenticated/invoices/index.tsx`, `sidebar-data.ts:95` | ✅ Lengkap |

### Frontend Customer Portal — Sudah Ada

| Komponen | File | Status |
|---|---|---|
| Halaman list tagihan dengan chip filter | `web/src/features/customer-portal/invoices/invoice-list.tsx` | ✅ Lengkap |
| Halaman detail tagihan + QR kode bayar + tombol bayar online | `web/src/features/customer-portal/invoices/invoice-detail.tsx` | ✅ Lengkap |
| Route `/portal/invoices` dan `/portal/invoices/:id` | `web/src/routes/portal/_app/invoices/` | ✅ Lengkap |

---

## Gap yang Perlu Diimplementasi

Dari seluruh spesifikasi, hanya **dua item kecil** yang belum ada:

1. **Filter bulan di admin invoice list** — backend belum support query param `month`, UI belum ada month picker
2. **Filter dropdown customer di admin invoice list** — backend sudah support `customer_id` param, tapi UI hanya punya text search, belum ada dropdown pilih customer

---

## Skema Database

**Tidak ada perubahan.** Model `Invoice` sudah lengkap di `store/model/invoice.go`:

```
id             uint, primary key, auto increment
invoice_number string(50), unique, format INV-YYYY-MM-NNNN
customer_id    uint, FK ke customers (RESTRICT)
subscription_id uint, FK ke subscriptions (RESTRICT)
amount         int64 (dalam rupiah, bukan decimal)
period_start   date
period_end     date
due_date       date
status         string(20): 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled'
payment_code   string(32), unique jika tidak kosong
issued_at      timestamp, nullable
paid_at        timestamp, nullable
notes          text, nullable
created_at     timestamp
updated_at     timestamp
```

> Catatan perbedaan dari spesifikasi awal:
> - `amount` tipe `int64` (sen/rupiah bulat), bukan `decimal(10,2)`
> - Status default `draft` (bukan `unpaid`); status `issued` = sudah diterbitkan ke customer
> - Endpoint create adalah `POST /invoices/generate` (bukan `POST /invoices`)
> - Endpoint cancel adalah `POST /invoices/:id/cancel` (bukan `PATCH`)

---

## Daftar API Endpoint

Semua endpoint sudah live. Ini adalah dokumentasi referensi.

### Endpoint Staff (butuh Bearer token)

| Method | Path | Keterangan |
|---|---|---|
| `GET` | `/api/v1/invoices` | List invoice; query params: `status`, `customer_id`, `subscription_id` |
| `GET` | `/api/v1/invoices/:id` | Detail invoice |
| `POST` | `/api/v1/invoices/generate` | Buat invoice manual (admin/operator) |
| `POST` | `/api/v1/invoices/:id/cancel` | Batalkan invoice (admin/operator) |

### Endpoint Customer Portal (butuh customer access token)

| Method | Path | Keterangan |
|---|---|---|
| `GET` | `/api/v1/customer/invoices` | List tagihan milik customer yang login; query param: `status` |
| `GET` | `/api/v1/customer/invoices/:id` | Detail tagihan (ownership check otomatis) |

### Yang Belum Ada di Backend

- Filter bulan pada `GET /invoices` — `InvoiceListFilter` struct (`store/invoice_store.go:14`) belum punya field `Month`/`Year`

---

## Komponen UI yang Perlu Dibuat

Hanya dua komponen tambahan yang perlu dibuat. Semua lainnya sudah ada.

### 1. Month Picker Filter di Halaman Admin Invoice

**File:** `web/src/features/invoices/index.tsx`

Tambahkan UI filter bulan di sebelah tombol "Buat Invoice":
- Gunakan komponen `<DatePicker>` yang sudah ada (`@/components/date-picker`) atau input type=month HTML native
- State: `selectedMonth` (format `YYYY-MM`, opsional)
- Saat berubah, pass ke query `useInvoices({ period_month: selectedMonth })`
- Ada tombol reset/clear filter bulan

Pastikan update `InvoiceListFilters` type di `web/src/features/invoices/api/schema.ts` dengan tambah field `period_month?: string`.

### 2. Dropdown Filter Customer di Halaman Admin Invoice (Opsional)

**File:** `web/src/features/invoices/index.tsx`

Tambahkan dropdown select customer di sebelah filter bulan:
- Ambil data dari `useCustomers()` yang sudah dipakai di komponen ini
- Saat customer dipilih, pass `customer_id` ke `useInvoices({ customer_id: selectedCustomerId })`
- Ini akan menggantikan/melengkapi text search yang sudah ada

> Ini bersifat opsional karena text search sudah cukup untuk jumlah customer kecil-menengah.

---

## Tahapan Implementasi

### Tahap 1 — Backend: Tambah Filter Bulan

**File yang disentuh:**
- `store/invoice_store.go` — `InvoiceListFilter` struct + implementasi query

**Langkah:**
1. Buka `store/invoice_store.go`, di struct `InvoiceListFilter` (baris 14) tambahkan dua field:
   ```
   PeriodYear  int  // 0 = tidak difilter
   PeriodMonth int  // 0 = tidak difilter; 1-12
   ```
2. Di method `List` (baris ~101), setelah blok filter `Status`, tambahkan kondisi:
   - Jika `f.PeriodYear != 0`: `.Where("EXTRACT(YEAR FROM period_start) = ?", f.PeriodYear)`
   - Jika `f.PeriodMonth != 0`: `.Where("EXTRACT(MONTH FROM period_start) = ?", f.PeriodMonth)`
3. Di `api/handler/invoices.go` method `List` (baris 50), tambahkan parsing query param `period_month` format `YYYY-MM`:
   - Parse string `"2024-06"` → year=2024, month=6
   - Set ke `f.PeriodYear` dan `f.PeriodMonth`
4. Jalankan `make test` untuk verifikasi

**Done criteria:**
- [ ] `GET /invoices?period_month=2024-06` hanya mengembalikan invoice dengan `period_start` di bulan Juni 2024
- [ ] `GET /invoices` tanpa param tetap mengembalikan semua invoice seperti sebelumnya
- [ ] `make build` dan `make test` lulus

---

### Tahap 2 — Frontend: Tambah Month Picker di Admin Invoice

**File yang disentuh:**
- `web/src/features/invoices/api/schema.ts` — tambah `period_month` ke `InvoiceListFilters`
- `web/src/features/invoices/index.tsx` — tambah state + UI month picker

**Langkah:**
1. Di `schema.ts`, update tipe `InvoiceListFilters`:
   ```ts
   period_month?: string  // format "YYYY-MM"
   ```
2. Di `index.tsx`, tambahkan state `const [periodMonth, setPeriodMonth] = useState<string | undefined>()`
3. Pass ke hook: `useInvoices({ status: activeStatus, period_month: periodMonth })`
   — tapi lihat dulu apakah `useInvoices` sudah accept `filters` atau tidak; lihat `api/queries.ts`
4. Tambahkan UI input filter di atas tabel, sebelah kanan tombol "Buat Invoice":
   ```html
   <input type="month" value={periodMonth} onChange={...} className="..." />
   {periodMonth && <Button onClick={() => setPeriodMonth(undefined)}>Reset</Button>}
   ```
   Atau gunakan komponen shadcn Select dengan daftar bulan 12 bulan terakhir.
5. Jalankan `pnpm dev`, buka `/invoices`, test filter bulan

**Done criteria:**
- [ ] Ada UI untuk memilih bulan di halaman invoice admin
- [ ] Memilih bulan memfilter list invoice sesuai bulan yang dipilih
- [ ] Ada tombol atau cara untuk reset filter kembali ke "semua bulan"
- [ ] `pnpm build` lulus tanpa error TypeScript

---

### Tahap 3 — Manual Test End-to-End (Opsional tapi Dianjurkan)

1. Jalankan stack: `make dev`
2. Buat beberapa invoice dengan bulan berbeda
3. Test filter bulan di halaman admin — pastikan hanya invoice bulan yang dipilih tampil
4. Buka customer portal, pastikan "Tagihan" masih berfungsi normal (tidak ada regresi)

---

## Referensi File Penting

| File | Kegunaan |
|---|---|
| `store/invoice_store.go:14` | `InvoiceListFilter` struct — tambah field di sini |
| `api/handler/invoices.go:50` | Handler `List` — tambah parsing query param di sini |
| `web/src/features/invoices/index.tsx` | Halaman admin — tambah month picker UI di sini |
| `web/src/features/invoices/api/schema.ts` | Tipe filter frontend — update `InvoiceListFilters` |
| `web/src/features/invoices/api/queries.ts` | React Query hooks — referensi cara pass filter |
| `job/billing_cron.go` | Cron auto-generate invoice — jangan diubah |
| `job/suspension_check.go:57` | Auto-mark overdue — jangan diubah |
