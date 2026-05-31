# Frontend Analysis — `web/`

> Analisis kondisi aktual codebase `c:\code\web\rosmon\web` per 31 Mei 2026.
> Referensi arsitektur: [`ARCHITECTURE.md`](file:///c:/code/web/rosmon/web/ARCHITECTURE.md).

---

## 1. Stack & Tooling

| Kategori | Library | Versi |
|---|---|---|
| UI Framework | React | ^19.2.5 |
| Build Tool | Vite | ^8.0.8 |
| Language | TypeScript | ~6.0.3 |
| Routing | TanStack Router (file-based) | ^1.168.22 |
| Server State | TanStack Query | ^5.99.0 |
| Client State | Zustand | ^5.0.12 |
| HTTP Client | Axios | ^1.15.0 |
| Schema/Validation | Zod | ^4.3.6 |
| Forms | React Hook Form + `@hookform/resolvers` | ^7.72.1 |
| UI Components | shadcn/ui (Radix UI primitives) | - |
| Styling | Tailwind CSS v4 | ^4.2.2 |
| Testing | Vitest + Playwright (browser) | ^4.1.4 |
| Tables | TanStack Table | ^8.21.3 |
| Charts | Recharts | ^3.8.1 |

---

## 2. Struktur Direktori Aktual

```
web/src/
├── lib/
│   └── api/
│       ├── client.ts          ✅ Axios instance + interceptors (token inject + refresh)
│       ├── types.ts           ✅ Envelope<T>, APIError, RouterOSRecord, dst.
│       ├── query-keys.ts      ✅ Factory `qk` — 191 baris, komprehensif
│       ├── errors.ts          ✅ parseAPIError, getAPIErrorCode, getAPIErrorDetails
│       ├── unwrap.ts          ✅ Helper unwrap Envelope<T>
│       ├── sse.ts             ✅ useSSE hook — EventSource + exponential backoff
│       ├── portal-client.ts   ✅ Axios instance terpisah untuk customer portal
│       └── errors.test.ts     ✅ Unit test parseAPIError
├── stores/
│   ├── auth-store.ts          ✅ Client state — JWT access+refresh token, user decode
│   ├── portal-auth-store.ts   ✅ Client state — JWT customer portal
│   ├── active-router-store.ts ✅ Client state — router aktif yang dipilih
│   └── quick-print-presets-meta-store.ts  ✅ Client state — UI metadata (color, label)
├── features/
│   ├── hotspot/               ✅ Sub-feature: users, active, inactive, hosts, profiles, ...
│   ├── ppp/                   ✅ PPPoE secrets, active, inactive, profiles
│   ├── voucher/               ✅ Sales, session, quick-print
│   ├── report/                ✅ Daily, monthly, resume, summary
│   ├── customers/             ✅ CRUD + api layer (queries + service + schema)
│   ├── subscriptions/         ✅ CRUD + status mutations + api layer
│   ├── network/               ✅ Interfaces, pools, queues, NAT, DHCP
│   ├── system/                ✅ Resource, log, clock, identity, schedulers
│   ├── customer-portal/       ✅ auth, home, invoices, payments, subscriptions, profile
│   ├── whatsapp/              ✅ Status + QR (api layer)
│   ├── message-templates/     ✅ CRUD templates
│   ├── audit-logs/            ✅ List audit logs
│   ├── notifications/         ✅ Log notifikasi
│   ├── registrations/         ✅ Fase 2 — pendaftaran pelanggan baru
│   ├── landing-page/          ✅ Public landing page
│   ├── public-register/       ✅ Form registrasi publik
│   ├── auth/                  ✅ Sign-in, refresh
│   ├── users/                 ✅ Staff user management (admin-only)
│   ├── admin/                 ✅ Admin panel
│   ├── dashboard/             ✅ Dashboard utama
│   ├── settings/              ✅ System settings
│   ├── traffic/               ✅ Interface traffic
│   ├── log/                   ✅ System log viewer
│   ├── errors/                ✅ Error pages (404, 500, dll)
│   └── help-center/           ✅ Halaman bantuan
├── routes/
│   ├── __root.tsx
│   ├── _authenticated/        ← Route staff dengan auth guard
│   │   ├── hotspot/, ppp/, voucher/, report/, network/, system/, ...
│   │   └── customers/, subscriptions/, settings/, users/, ...
│   └── portal/                ← Route customer portal
├── components/                ← Shared UI components
├── context/                   ← ThemeProvider, FontProvider, DirectionProvider
├── hooks/                     ← Cross-cutting hooks
├── config/                    ← App config
└── styles/                    ← index.css (Tailwind)
```

---

## 3. Infrastruktur API — Status ✅ Sudah Selesai

### 3.1. `lib/api/client.ts`
- ✅ Axios instance tunggal, `baseURL` = `VITE_API_URL + /api/v1`
- ✅ Request interceptor: inject `Authorization: Bearer <token>` dari `useAuthStore`
- ✅ Response interceptor: **transparent token refresh** on 401 dengan queue concurrent requests
- ✅ Refresh gagal → `auth.reset()` + biarkan error bubble ke `QueryCache.onError` di `main.tsx`
- ⚠️ Satu hal yang perlu perhatian: kondisi 401 refresh **tidak ter-trigger** jika `originalRequest.url` tidak include `/auth/refresh`. Logika saat ini menggunakan `||` (OR) sehingga request NON-refresh yang dapat 401 akan **skip refresh** dan langsung reject. Ini bug logika: seharusnya kondisi ketiga tanpa negasi.

  ```ts
  // Kondisi saat ini (baris 51-56):
  if (
    error.response?.status !== 401 ||
    originalRequest._retry ||
    !originalRequest.url?.includes('/auth/refresh')  // ← negasi ini membalik maksudnya
  ) {
    return Promise.reject(error)   // ← skip refresh untuk semua non-refresh-endpoint
  }
  
  // Seharusnya:
  if (
    error.response?.status !== 401 ||
    originalRequest._retry ||
    originalRequest.url?.includes('/auth/refresh')  // tanpa negasi
  ) {
    return Promise.reject(error)
  }
  ```

### 3.2. `lib/api/types.ts`
- ✅ `Envelope<T>` → `{ data: T|null, error: APIError|null, meta?: ListMeta }`
- ✅ `APIError` dengan `code` + `message` + `details?`
- ✅ `RouterOSRecord` — untyped MikroTik record (intentional, per-domain Zod)
- ✅ `AddResult`, `MessageResult`, `CountResponse`

### 3.3. `lib/api/query-keys.ts`
- ✅ Factory `qk` terpusat — 40+ keys mencakup seluruh domain
- ✅ Pattern: `[domain, resource, ...identifiers, filters?]`
- ✅ Covers: auth, hotspot, ppp, network, system, voucher, report, customers, subscriptions, portal, whatsapp, registrations, dll.

### 3.4. `lib/api/errors.ts`
- ✅ `parseAPIError(err)` → string human-readable
- ✅ `getAPIErrorCode(err)` → machine code untuk branching
- ✅ `getAPIErrorDetails(err)` → detail payload (per-field errors)
- ✅ Unit test tersedia (`errors.test.ts`)

### 3.5. `lib/api/unwrap.ts`
- ✅ `unwrap<T>(env)` — throw jika `data === null` pada 2xx response (backend bug guard)

### 3.6. `lib/api/sse.ts`
- ✅ `useSSE<T>(path, onEvent, opts)` — generic SSE hook
- ✅ Token via `?access_token=` query param (karena EventSource tidak support custom headers)
- ✅ Exponential backoff reconnect (1s, 2s, 4s… capped `maxBackoffMs`, default 30s)
- ✅ Ref pattern untuk `onEvent` callback — tidak reconnect tiap render
- ✅ Support `path = null` untuk "park" koneksi (saat routerId belum dipilih)

### 3.7. `lib/api/portal-client.ts`
- ✅ Axios instance terpisah untuk customer portal
- ✅ Inject token dari `usePortalAuthStore` (JWT berbeda dari staff)

---

## 4. Stores — Status ✅ Sudah Bersih

Berbeda dengan rencana di ARCHITECTURE.md (yang menulis banyak stores yang perlu dihapus), kondisi aktual stores sudah sangat bersih:

| File | Jenis | Status |
|---|---|---|
| `auth-store.ts` | Client state (access + refresh token, user) | ✅ Tetap |
| `portal-auth-store.ts` | Client state (customer JWT) | ✅ Tepat — terpisah dari staff |
| `active-router-store.ts` | Client state (router aktif) | ✅ Tetap |
| `quick-print-presets-meta-store.ts` | Client state (UI-only meta: color, label) | ✅ Tepat — bukan server state |

> **Kesimpulan**: Semua server state stores yang disebutkan di ARCHITECTURE.md untuk dihapus (`hotspot-users-store`, `tenants-store`, dll.) sudah **tidak ada**. Migrasi ke TanStack Query sudah selesai.

---

## 5. Pattern Per-Feature — Audit Representatif

### 5.1. `features/customers/` ✅ Pola Ideal
```
api/
├── schema.ts   ← Zod schema + type Customer, CustomerCreateInput, CustomerListFilters
├── service.ts  ← listCustomers, createCustomer, updateCustomer, removeCustomer
└── queries.ts  ← useCustomers, useCreateCustomer, useUpdateCustomer, useRemoveCustomer
```
- Menggunakan `unwrap()` untuk semua calls
- Filter struct di schema, bukan inline di service
- Invalidate dengan prefix `['customers']` — semua filter ter-invalidate sekaligus

### 5.2. `features/subscriptions/` ✅ Pola Ideal + Extended
```
api/
├── schema.ts   ← SubscriptionStatus union type, SUBSCRIPTION_STATUSES array
├── service.ts  ← list, create, update, patchStatus, reconcile, remove
└── queries.ts  ← useSubscriptions, useCreateSubscription, usePatchSubscriptionStatus,
                  useReconcileSubscription, useRemoveSubscription
```
- Status patch sebagai mutation terpisah (`usePatchSubscriptionStatus`) — pattern yang benar
- `useReconcileSubscription` untuk trigger outbox sync dari UI
- `SubscriptionWriteResult` type mencakup optional `warning` field

### 5.3. `features/hotspot/` ✅ Multi-sub-feature
- Sub-folder: `users`, `active`, `inactive`, `hosts`, `profiles`, `servers`, `bindings`, `cookies`, `billing`, `_shared`
- `_shared/` pattern untuk komponen/utilitas yang dipakai multiple hotspot sub-features
- SSE kemungkinan besar dipakai di `active` (hotspot active sessions real-time)

### 5.4. `features/customer-portal/` ✅ Scope Terpisah
- Sub-folder: `auth`, `home`, `invoices`, `payments`, `subscriptions`, `profile`, `tickets`
- Auth pakai `usePortalAuthStore` — JWT berbeda dari staff
- Route terpisah di `routes/portal/`

---

## 6. Routing — TanStack Router File-based

### Route Zones:
```
routes/
├── __root.tsx                     ← Root layout
├── index.tsx                      ← Redirect ke /dashboard
├── (auth)/                        ← Public: /sign-in, /otp
├── (errors)/                      ← 404, 500, forbidden
├── (public)/                      ← Landing page, public registration
├── _authenticated/                ← Staff zone (auth guard)
│   ├── route.tsx                  ← Auth guard + layout
│   ├── dashboard.tsx
│   ├── hotspot/, ppp/, voucher/   ← Router-scoped features
│   ├── customers/, subscriptions/ ← Business layer
│   ├── settings/, users/          ← Admin
│   └── ...
└── portal/                        ← Customer portal zone
```

- ✅ Route-based code splitting otomatis via TanStack Router
- ✅ `routeTree.gen.ts` auto-generated (61KB) — jangan edit manual
- ✅ `defaultPreload: 'intent'` — prefetch on hover/focus

---

## 7. Global Error Handling — `main.tsx`

```
QueryClient config:
├── queries.retry         ← false di DEV, retry 3x di PROD (skip 401/403)
├── queries.staleTime     ← 10 detik
├── mutations.onError     ← handleServerError() global
└── QueryCache.onError    ← 401 → toast + redirect /sign-in
                          ← 500 → toast (+ redirect /500 di PROD)
```

- ✅ 401 handling: interceptor di `client.ts` coba refresh dulu, baru `QueryCache.onError` redirect
- ✅ 500 handling: di PROD redirect ke error page
- ✅ No retry di DEV — DX lebih mudah debug
- ⚠️ Bug di refresh interceptor (lihat §8.1) bisa membuat 401 langsung go to QueryCache tanpa sempat refresh

---

## 8. Hal yang Perlu Diperhatikan

### 8.1. 🐛 Bug Token Refresh — Medium Priority

Di [`lib/api/client.ts` baris 50–56](file:///c:/code/web/rosmon/web/src/lib/api/client.ts#L50-L56), kondisi guard menggunakan `||` yang salah logika. Kondisi ketiga `!originalRequest.url?.includes('/auth/refresh')` dimaksudkan sebagai "jangan refresh kalau endpoint-nya adalah /auth/refresh itu sendiri (untuk mencegah loop)". Tapi dengan `||`, semua 401 dari endpoint non-refresh juga ikut skip karena kondisi ketiga evaluasi ke `true` untuk mereka.

**Dampak**: Token refresh tidak pernah berjalan → setiap 401 langsung bubble ke QueryCache → user dilempar ke sign-in padahal refresh token masih valid.

**Fix satu baris** di `client.ts`:
```diff
-  !originalRequest.url?.includes('/auth/refresh')
+  originalRequest.url?.includes('/auth/refresh')
```

### 8.2. ⚠️ Duplikasi Folder `report/` vs `reports/`

Di `features/` ada dua folder: `report/` dan `reports/`. Di `routes/_authenticated/` juga ada `report/` dan `reports/`. Perlu diklarifikasi mana yang aktif dan mana yang deprecated agar tidak membingungkan contributor baru.

### 8.3. ⚠️ `@clerk/react` di Dependencies

`package.json` mencantumkan `@clerk/react: ^6.4.2` namun Clerk (auth-as-a-service) bukan bagian dari auth stack — sistem auth custom sendiri via JWT. Kemungkinan sisa dari template shadcn-admin. Perlu di-remove untuk mengurangi bundle size dan ambiguitas.

### 8.4. ℹ️ `openapi-typescript` Belum Dipasang

ARCHITECTURE.md merekomendasikan `pnpm add -D openapi-typescript` + script `gen:api`. Belum ada di `package.json`. Implementasi ini opsional tapi akan meningkatkan type-safety end-to-end secara signifikan — terutama saat backend OpenAPI spec berkembang.

### 8.5. ℹ️ Audit `store/` Sub-folder dalam Features

Beberapa features (`customers/store/`, `subscriptions/store/`, `registrations/store/`) memiliki sub-folder `store/`. Berdasarkan ARCHITECTURE.md, ini boleh diisi dengan Zustand **UI state khusus feature** (bukan server state). Perlu dipastikan tidak ada server state yang tersimpan di sana.

---

## 9. Kekuatan Arsitektur Saat Ini

| Aspek | Status |
|---|---|
| Server state di TanStack Query | ✅ Semua server state sudah out dari Zustand |
| Client state di Zustand | ✅ 4 store — semuanya genuinely client state |
| Axios instance tunggal | ✅ `apiClient` di `lib/api/client.ts` |
| Query key terpusat | ✅ `qk` factory dengan 40+ keys |
| Error parsing terpusat | ✅ `parseAPIError`, `getAPIErrorCode` |
| Envelope unwrap | ✅ `unwrap<T>()` helper |
| SSE infrastruktur | ✅ `useSSE` dengan exponential backoff |
| Customer portal terpisah | ✅ JWT & axios client berbeda |
| Auth refresh transparan | ✅ (ada minor bug, lihat §8.1) |
| Form pattern | ✅ RHF + zodResolver + mutation |
| Route zones | ✅ public / staff / portal |
| Zod schema per feature | ✅ Konsisten |
| TypeScript strict | ✅ (tsconfig.app.json) |

---

## 10. Rekomendasi Prioritas

### 🔴 Segera
1. **Fix bug token refresh** di `client.ts` — hapus `!` di kondisi ketiga (§8.1)

### 🟡 Short-term
2. **Hapus `@clerk/react`** dari dependencies — tidak dipakai, polusi bundle
3. **Klarifikasi `report/` vs `reports/`** — merge atau hapus yang duplikat
4. **Audit `store/` sub-folder** dalam features — pastikan tidak ada server state tersembunyi

### 🟢 Nice-to-have
5. **Tambah `openapi-typescript`** + script `gen:api` — type-safety end-to-end
6. **Test coverage** untuk `service.ts` dan `queries.ts` per feature — saat ini hanya `errors.test.ts` dan store tests

---

## 11. Ringkasan

Frontend rosmon sudah dalam kondisi **arsitektur yang sangat baik** dan konsisten. Migrasi dari Zustand-as-server-state ke TanStack Query sudah selesai. Infrastruktur API sudah lengkap dan reusable. Pattern per-feature (`schema → service → queries → komponen`) sudah diterapkan konsisten di semua domain baru (customers, subscriptions, portal).

Satu-satunya bug kritis adalah logika kondisi di token refresh interceptor yang perlu difix segera. Sisanya adalah housekeeping (dependency cleanup, dedup folder).
