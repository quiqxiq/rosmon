# Frontend API Integration Plan

> Berdasarkan `openapi/openapi.yaml` + `ARCHITECTURE.md`.  
> Dokumen ini mendaftar **setiap file yang harus dibuat, diubah, atau dihapus** — bukan hanya daftar hook.

---

## Ringkasan Eksekutif

| Kategori | Jumlah |
|---|---|
| File baru di `src/lib/api/` | 4 |
| Folder `api/` baru di features | 15 |
| Store yang dihapus (`src/stores/`) | 8 |
| Schema yang perlu diupdate | 6 |
| Feature baru (belum ada folder) | 0 (semua sudah ada, tapi belum punya `api/`) |

---

## Bagian A — `src/lib/api/` (Infrastruktur, dibuat duluan)

Tidak ada satupun file di `src/lib/api/` saat ini. Semua harus dibuat baru.

### `src/lib/api/client.ts` — BUAT BARU

```
Tanggung jawab:
- axios instance dengan baseURL dari VITE_API_URL
- request interceptor: inject Authorization + X-Tenant-Slug
- response interceptor: 401 → auth.reset() + redirect /sign-in
```

Dependencies: `useAuthStore` · `useActiveTenantStore`

### `src/lib/api/types.ts` — BUAT BARU

```ts
// Mapping ke backend pkg/httpresp/respond.go
Envelope<T>       = { data: T | null; error: string | null }
APIError          = { status: number; message: string; detail?: unknown }
PaginationMeta    = { page: number; per_page: number; total: number; total_pages: number }
Paginated<T>      = { items: T[]; meta: PaginationMeta }
```

### `src/lib/api/errors.ts` — BUAT BARU

```
Tanggung jawab:
- parseAPIError(unknown) → string
- Baca envelope error dari AxiosError response
- Gantikan src/lib/handle-server-error.ts untuk domain errors
  (handle-server-error tetap ada untuk global toast handler)
```

### `src/lib/api/query-keys.ts` — BUAT BARU

Satu file, semua query keys. Lihat §C untuk daftar lengkapnya.

---

## Bagian B — Store Migration

### B.1 Tetap Zustand

| File | Status |
|---|---|
| `src/stores/auth-store.ts` | **UBAH SHAPE** `AuthUser` (lihat §B.3) |
| `src/stores/active-tenant-store.ts` | Tetap, tidak ada perubahan |
| `src/stores/role-mock-store.ts` | Tetap sementara. Hapus saat JWT RBAC wired |

### B.2 Hapus (Server State → TanStack Query)

| File Store | Digantikan oleh | Seed dipindah ke |
|---|---|---|
| `src/stores/hotspot-users-store.ts` | `features/hotspot/users/api/queries.ts` | sudah ada di `features/hotspot/users/data/data.ts` |
| `src/stores/hotspot-profiles-store.ts` | `features/hotspot/profiles/api/queries.ts` | sudah ada di `features/hotspot/profiles/data/data.ts` |
| `src/stores/hotspot-active-store.ts` | `features/hotspot/active/api/queries.ts` | sudah ada di `features/hotspot/active/data/data.ts` |
| `src/stores/hotspot-hosts-store.ts` | `features/hotspot/hosts/api/queries.ts` | sudah ada di `features/hotspot/hosts/data/data.ts` |
| `src/stores/voucher-sales-store.ts` | `features/voucher/sales/api/queries.ts` | sudah ada di `features/voucher/data/sales.ts` |
| `src/stores/quick-print-presets-store.ts` | `features/voucher/print/api/queries.ts` | sudah ada di `features/voucher/print/data/data.ts` |
| `src/stores/tenants-store.ts` | `features/admin/tenants/api/queries.ts` | sudah ada di `features/admin/tenants/data/data.ts` |
| `src/stores/global-templates-store.ts` | `features/admin/templates/api/queries.ts` | sudah ada di `features/admin/templates/data/data.ts` |

> Seed data di `data/data.ts` **tidak dihapus** — masih dipakai untuk Storybook / unit test.

### B.3 `auth-store.ts` — Shape Update

Shape saat ini **tidak match** response `/auth/login`:

```ts
// SEKARANG (salah)
interface AuthUser {
  accountNo: string   // ← tidak ada di API
  email: string       // ← tidak ada di API
  role: string[]      // ← API kirim string tunggal
  exp: number
}

// SETELAH UPDATE (match API)
interface AuthUser {
  id: number
  username: string
  role: string         // 'superadmin' | 'owner' | 'admin' | 'staff'
  tenant_id: number
  tenant_slug: string
}
```

File yang perlu ikut diupdate: `src/features/auth/sign-in/components/user-auth-form.tsx` (hapus mock, pakai `useLogin` mutation).

---

## Bagian C — `src/lib/api/query-keys.ts` — Isi Lengkap

```ts
export const qk = {
  // --- auth ---
  currentUser:          () => ['auth', 'me'] as const,

  // --- status ---
  serverStatus:         () => ['status'] as const,

  // --- admin tenants ---
  adminTenants:         (f?: object) => ['admin', 'tenants', f ?? {}] as const,
  adminTenant:          (id: string) => ['admin', 'tenants', id] as const,

  // --- tenant self ---
  tenantSelf:           () => ['tenant', 'self'] as const,
  tenantSettings:       () => ['tenant', 'settings'] as const,

  // --- users ---
  users:                (f?: object) => ['users', f ?? {}] as const,
  user:                 (id: string) => ['users', id] as const,

  // --- routers ---
  routers:              () => ['routers'] as const,
  router:               (rid: number) => ['routers', rid] as const,

  // --- hotspot users ---
  hotspotUsers:         (rid: number, f?: object) => ['hotspot', 'users', rid, f ?? {}] as const,
  hotspotUser:          (rid: number, uid: string) => ['hotspot', 'users', rid, uid] as const,
  hotspotUserCount:     (rid: number, profile?: string) => ['hotspot', 'users', 'count', rid, profile ?? null] as const,

  // --- hotspot profiles ---
  hotspotProfiles:      (rid: number) => ['hotspot', 'profiles', rid] as const,
  hotspotProfile:       (rid: number, pid: string) => ['hotspot', 'profiles', rid, pid] as const,

  // --- hotspot active/inactive ---
  hotspotActive:        (rid: number) => ['hotspot', 'active', rid] as const,
  hotspotInactive:      (rid: number) => ['hotspot', 'inactive', rid] as const,
  hotspotInactiveCount: (rid: number) => ['hotspot', 'inactive', 'count', rid] as const,

  // --- hotspot misc ---
  hotspotHosts:         (rid: number) => ['hotspot', 'hosts', rid] as const,
  hotspotServers:       (rid: number) => ['hotspot', 'servers', rid] as const,
  hotspotCookies:       (rid: number) => ['hotspot', 'cookies', rid] as const,
  hotspotBindings:      (rid: number) => ['hotspot', 'bindings', rid] as const,
  walledGarden:         (rid: number) => ['hotspot', 'walled-garden', rid] as const,
  walledGardenIP:       (rid: number) => ['hotspot', 'walled-garden-ip', rid] as const,

  // --- ppp ---
  pppSecrets:           (rid: number) => ['ppp', 'secrets', rid] as const,
  pppActive:            (rid: number) => ['ppp', 'active', rid] as const,
  pppInactive:          (rid: number) => ['ppp', 'inactive', rid] as const,
  pppInactiveCount:     (rid: number) => ['ppp', 'inactive', 'count', rid] as const,
  pppProfiles:          (rid: number) => ['ppp', 'profiles', rid] as const,

  // --- network ---
  networkInterfaces:    (rid: number) => ['network', 'interfaces', rid] as const,
  interfaceTraffic:     (rid: number, iface: string) => ['network', 'traffic', rid, iface] as const,
  networkPools:         (rid: number) => ['network', 'pools', rid] as const,
  networkQueues:        (rid: number) => ['network', 'queues', rid] as const,
  natRules:             (rid: number) => ['network', 'nat', rid] as const,
  dhcpLeases:           (rid: number) => ['network', 'dhcp', 'leases', rid] as const,

  // --- system ---
  systemResource:       (rid: number) => ['system', 'resource', rid] as const,
  systemResourceHistory:(rid: number) => ['system', 'resource', 'history', rid] as const,
  systemLog:            (rid: number) => ['system', 'log', rid] as const,
  systemClock:          (rid: number) => ['system', 'clock', rid] as const,
  systemIdentity:       (rid: number) => ['system', 'identity', rid] as const,
  routerboard:          (rid: number) => ['system', 'routerboard', rid] as const,
  expireMonitor:        (rid: number) => ['system', 'expire-monitor', rid] as const,
  schedulers:           (rid: number) => ['system', 'schedulers', rid] as const,
  scripts:              (rid: number) => ['system', 'scripts', rid] as const,
  systemDashboard:      (rid: number) => ['system', 'dashboard', rid] as const,

  // --- vouchers ---
  voucherPrintData:     (rid: number) => ['voucher', 'print-data', rid] as const,

  // --- templates ---
  templates:            (f?: object) => ['templates', f ?? {}] as const,
  template:             (id: string) => ['templates', id] as const,

  // --- reports ---
  reportDaily:          (rid: number, date: string) => ['report', 'daily', rid, date] as const,
  reportMonthly:        (rid: number, month: string) => ['report', 'monthly', rid, month] as const,
  reportResume:         (rid: number) => ['report', 'resume', rid] as const,
  reportSummary:        (rid: number) => ['report', 'summary', rid] as const,

  // --- quick-print ---
  quickPrintPackages:   (rid: number) => ['quick-print', 'packages', rid] as const,
  quickPrintPackage:    (rid: number, name: string) => ['quick-print', 'packages', rid, name] as const,

  // --- profile mappings ---
  profileMappings:      (rid: number) => ['profile-mappings', rid] as const,
} as const
```

---

## Bagian D — File per Feature Domain

Format setiap domain:
```
status: NEW = file baru | MOD = ubah existing | DEL = hapus
```

---

### D.1 `features/auth/`

```
features/auth/
├── api/                              ← FOLDER BARU
│   ├── service.ts                    NEW — fungsi axios: login, logout, getMe, changePassword, setup
│   └── queries.ts                    NEW — useLogin, useLogout, useCurrentUser, useChangePassword, useSetupFirstTenant
├── sign-in/
│   └── components/
│       └── user-auth-form.tsx        MOD — hapus mock, pakai useLogin mutation
└── (sign-up, otp, forgot-password — skip, tidak ada di API Roskit)
```

**Hooks yang dibuat:**

| Hook | Type | Endpoint |
|---|---|---|
| `useLogin` | mutation | `POST /auth/login` |
| `useLogout` | mutation | `POST /auth/logout` |
| `useCurrentUser` | query | `GET /auth/me` |
| `useChangePassword` | mutation | `PUT /auth/password` |
| `useSetupFirstTenant` | mutation | `POST /auth/setup` |
| `useServerStatus` | query | `GET /status` |

**Catatan**: `useServerStatus` bisa diletakkan di `features/auth/api/queries.ts` karena dipakai di halaman login.

---

### D.2 `features/admin/tenants/`

```
features/admin/tenants/
├── api/                              ← FOLDER BARU
│   ├── service.ts                    NEW
│   └── queries.ts                    NEW
├── data/
│   ├── schema.ts                     MOD — update field ke match API response
│   └── data.ts                       — tetap (seed untuk dev/test)
└── store/
    └── tenants-dialog-store.ts       — tetap (UI state dialog)
```

**Hooks yang dibuat:**

| Hook | Type | Endpoint |
|---|---|---|
| `useAdminTenants(filters?)` | query | `GET /admin/tenants` |
| `useAdminTenant(id)` | query | `GET /admin/tenants/{id}` |
| `useCreateAdminTenant` | mutation | `POST /admin/tenants` |
| `useUpdateAdminTenant` | mutation | `PUT /admin/tenants/{id}` |
| `useHardDeleteAdminTenant` | mutation | `DELETE /admin/tenants/{id}` |
| `useSuspendAdminTenant` | mutation | `POST /admin/tenants/{id}/suspend` |
| `useActivateAdminTenant` | mutation | `POST /admin/tenants/{id}/activate` |

**Hapus**: `src/stores/tenants-store.ts`  
**Invalidate pattern**: `['admin', 'tenants']` setelah semua mutasi

---

### D.3 `features/admin/templates/`

```
features/admin/templates/
├── api/                              ← FOLDER BARU
│   ├── service.ts                    NEW
│   └── queries.ts                    NEW
├── data/
│   ├── schema.ts                     MOD — update ke match API response
│   ├── data.ts                       — tetap (seed)
│   └── builtin-defaults.ts           — tetap (UI helper)
└── lib/
    └── compose-preview.ts            — tetap (render preview, UI logic)
```

**Hooks yang dibuat:**

| Hook | Type | Endpoint |
|---|---|---|
| `useTemplates(filters?)` | query | `GET /templates` |
| `useTemplate(id)` | query | `GET /templates/{id}` |
| `useCreateTemplate` | mutation | `POST /templates` |
| `useUpdateTemplate` | mutation | `PUT /templates/{id}` |
| `useDeleteTemplate` | mutation | `DELETE /templates/{id}` |
| `useRenderTemplate` | mutation | `POST /templates/render` |
| `useSeedDefaultTemplates` | mutation | `POST /templates/seed-defaults` |
| `useAdminUpdateTemplate` | mutation | `PUT /admin/templates/{id}` |
| `useAdminDeleteTemplate` | mutation | `DELETE /admin/templates/{id}` |

**Hapus**: `src/stores/global-templates-store.ts`

---

### D.4 `features/hotspot/users/`

```
features/hotspot/users/
├── api/                              ← FOLDER BARU
│   ├── service.ts                    NEW
│   └── queries.ts                    NEW
├── data/
│   ├── schema.ts                     MOD — tambah schema API response (raw RouterOS)
│   └── data.ts                       — tetap (seed)
└── store/
    └── users-dialog-store.ts         — tetap (UI state)
```

**Catatan schema**: API mengembalikan raw RouterOS dengan key seperti `.id`, `mac-address`, `bytes-in`. Buat dua schema:
- `HotspotUserAPISchema` — match persis API (snake-case/hyphen)
- `HotspotUser` (existing) — camelCase untuk komponen
- Transform di `service.ts`

**Hooks yang dibuat:**

| Hook | Type | Endpoint |
|---|---|---|
| `useHotspotUsers(routerId, filters?)` | query | `GET .../hotspot/users` |
| `useHotspotUser(routerId, id)` | query | `GET .../hotspot/users/{id}` |
| `useHotspotUserCount(routerId, profile?)` | query | `GET .../hotspot/users/count` |
| `useAddHotspotUser` | mutation | `POST .../hotspot/users` |
| `useUpdateHotspotUser` | mutation | `PUT .../hotspot/users/{id}` |
| `useRemoveHotspotUser` | mutation | `DELETE .../hotspot/users/{id}` |
| `useResetHotspotUserCounters` | mutation | `POST .../users/{id}/reset-counters` |
| `exportHotspotUsers(routerId)` | download fn | `GET .../hotspot/users/export` |

**Hapus**: `src/stores/hotspot-users-store.ts`  
**Komponen yang perlu update**: semua komponen di `users/components/` dan `features/hotspot/index.tsx`

---

### D.5 `features/hotspot/profiles/`

```
features/hotspot/profiles/
├── api/                              ← FOLDER BARU
│   ├── service.ts                    NEW
│   └── queries.ts                    NEW
├── data/
│   └── schema.ts                     MOD — tambah API schema
└── store/
    └── profiles-dialog-store.ts      — tetap
```

**Hooks yang dibuat:**

| Hook | Type | Endpoint |
|---|---|---|
| `useHotspotProfiles(routerId)` | query | `GET .../hotspot/profiles` |
| `useHotspotProfile(routerId, id)` | query | `GET .../hotspot/profiles/{id}` |
| `useAddHotspotProfile` | mutation | `POST .../hotspot/profiles` |
| `useUpdateHotspotProfile` | mutation | `PUT .../hotspot/profiles/{id}` |
| `useRemoveHotspotProfile` | mutation | `DELETE .../hotspot/profiles/{id}` |

**Hapus**: `src/stores/hotspot-profiles-store.ts`  
**Catatan**: `setMonitor` (deploy expire monitor per profile) → digantikan `useDeployExpireMonitor` di `features/system/`

---

### D.6 `features/hotspot/active/`

```
features/hotspot/active/
├── api/                              ← FOLDER BARU
│   ├── service.ts                    NEW
│   ├── queries.ts                    NEW
│   └── sse.ts                        NEW — useHotspotActiveStream
└── store/
    └── active-dialog-store.ts        — tetap
```

**Hooks yang dibuat:**

| Hook | Type | Endpoint |
|---|---|---|
| `useHotspotActive(routerId)` | query | `GET .../hotspot/active` |
| `useRemoveHotspotActive` | mutation | `DELETE .../active/{id}` |
| `useDisconnectHotspotUser` | mutation | `POST .../active/{id}/disconnect` |
| `useHotspotActiveStream(routerId)` | SSE hook | `GET .../sse/hotspot/active` |

**Hapus**: `src/stores/hotspot-active-store.ts`

---

### D.7 `features/hotspot/hosts/`

```
features/hotspot/hosts/
├── api/                              ← FOLDER BARU
│   ├── service.ts                    NEW
│   └── queries.ts                    NEW
└── store/
    └── hosts-dialog-store.ts         — tetap
```

**Hooks yang dibuat:**

| Hook | Type | Endpoint |
|---|---|---|
| `useHotspotHosts(routerId)` | query | `GET .../hotspot/hosts` |
| `useRemoveHotspotHost` | mutation | `DELETE .../hotspot/hosts/{id}` |

**Hapus**: `src/stores/hotspot-hosts-store.ts`  
**Catatan**: `bypass` di store lama tidak ada di API — fitur ini UI-only atau belum ada di backend.

---

### D.8 `features/hotspot/` — Sub-domain Baru (belum ada folder)

Domain berikut belum punya folder feature. Buat struktur minimal:

#### `features/hotspot/inactive/`
```
features/hotspot/inactive/
├── api/
│   ├── service.ts                    NEW
│   └── queries.ts                    NEW — useHotspotInactive, useHotspotInactiveCount
└── data/
    └── schema.ts                     NEW — HotspotInactiveUser schema
```

#### `features/hotspot/servers/`
```
features/hotspot/servers/
└── api/
    ├── service.ts                    NEW
    └── queries.ts                    NEW — useHotspotServers
```

#### `features/hotspot/cookies/`
```
features/hotspot/cookies/
└── api/
    ├── service.ts                    NEW
    └── queries.ts                    NEW — useHotspotCookies, useRemoveHotspotCookie
```

#### `features/hotspot/bindings/`
```
features/hotspot/bindings/
├── api/
│   ├── service.ts                    NEW
│   └── queries.ts                    NEW
└── data/
    └── schema.ts                     NEW
```

Hooks: `useHotspotBindings`, `useAddHotspotBinding`, `useUpdateHotspotBinding`, `useRemoveHotspotBinding`, `useEnableHotspotBinding`, `useDisableHotspotBinding`

#### `features/hotspot/walled-garden/`
```
features/hotspot/walled-garden/
└── api/
    ├── service.ts                    NEW
    └── queries.ts                    NEW — useWalledGarden, useAddWalledGarden, useRemoveWalledGarden, useWalledGardenIP, useAddWalledGardenIP, useRemoveWalledGardenIP
```

#### `features/hotspot/profile-mappings/`
```
features/hotspot/profile-mappings/
└── api/
    ├── service.ts                    NEW
    └── queries.ts                    NEW — useProfileMappings, useUpdateProfileMapping, useDeleteProfileMapping
```

---

### D.9 `features/voucher/` (Migrasi + Tambahan)

```
features/voucher/
├── api/                              ← FOLDER BARU (shared voucher infra)
│   ├── service.ts                    NEW — generate, cache, printData, recordSale, importSales, printVouchers
│   └── queries.ts                    NEW — useGenerateVouchers, useCacheVoucher, useVoucherPrintData, useRecordSale, useImportSales, usePrintVouchers
├── generate/
│   └── api/                          ← FOLDER BARU (atau pakai features/voucher/api/)
├── print/
│   └── api/                          ← FOLDER BARU
│       ├── service.ts                NEW — listPackages, createPackage, updatePackage, removePackage
│       └── queries.ts                NEW — useQuickPrintPackages, useQuickPrintPackage, useCreateQuickPrintPackage, useUpdateQuickPrintPackage, useRemoveQuickPrintPackage
└── sales/
    └── api/                          ← FOLDER BARU
        ├── service.ts                NEW
        └── queries.ts                NEW — useVoucherSales (dari reports endpoint, bukan voucher endpoint)
```

**Hapus**: `src/stores/voucher-sales-store.ts` · `src/stores/quick-print-presets-store.ts`

**Catatan struktur**: `voucher/api/` untuk operasi generate/print/record. `voucher/print/api/` khusus quick-print package CRUD. `voucher/sales/api/` untuk history sales.

---

### D.10 `features/report/`

```
features/report/
├── api/                              ← FOLDER BARU
│   ├── service.ts                    NEW — getDailyReport, getMonthlyReport, getResumeReport, getDashboardSummary, downloadCSV, downloadExcel
│   └── queries.ts                    NEW — useDailyReport, useMonthlyReport, useResumeReport, useDashboardSummary
├── daily/
│   └── data/
│       └── schema.ts                 MOD — update ke match API response
└── monthly/
    └── data/
        └── schema.ts                 MOD — update ke match API response
```

**Catatan schema**: `report/daily/data/schema.ts` saat ini referensi `voucherSaleSchema` dari local data. Harus diganti ke schema dari API response.

Download (CSV/Excel) pakai fungsi plain, bukan `useQuery`:
```ts
// bukan hook, panggil langsung di onClick handler
export async function downloadReportCSV(routerId: number, params: ReportParams): Promise<void>
export async function downloadReportExcel(routerId: number, params: ReportParams): Promise<void>
```

---

### D.11 `features/traffic/`

Feature ini sudah punya `data/schema.ts` dengan `NetInterface` dan `TrafficSample`. Punya folder `components/` tapi **tidak ada `api/`**.

```
features/traffic/
└── api/                              ← FOLDER BARU
    ├── service.ts                    NEW — listInterfaces, getInterfaceTraffic
    ├── queries.ts                    NEW — useNetworkInterfaces, useInterfaceTraffic
    └── sse.ts                        NEW — useInterfaceTrafficStream
```

**Catatan**: Traffic chart saat ini menggunakan data mock di `data/data.ts`. Setelah wiring, pakai `useInterfaceTrafficStream` untuk live mode dan `useInterfaceTraffic` untuk history mode.

---

### D.12 `features/log/`

Feature sudah ada dengan `data/schema.ts` dan `components/`. Tidak ada `api/`.

```
features/log/
└── api/                              ← FOLDER BARU
    ├── service.ts                    NEW — getSystemLog
    ├── queries.ts                    NEW — useSystemLog
    └── sse.ts                        NEW — useLogStreamAll, useLogStreamHotspot, useLogStreamPPP
```

---

### D.13 `features/users/`

```
features/users/
└── api/                              ← FOLDER BARU
    ├── service.ts                    NEW
    └── queries.ts                    NEW — useUsers, useUser, useCreateUser, useUpdateUser, useDeleteUser
```

Schema di `users/data/schema.ts` perlu dicek match dengan API `/users` response.

---

### D.14 Domain Baru (belum ada folder sama sekali)

#### `features/routers/`
```
features/routers/
├── api/
│   ├── service.ts                    NEW
│   └── queries.ts                    NEW
└── data/
    └── schema.ts                     NEW — Router schema
```

Hooks: `useRouters`, `useRouter`, `useCreateRouter`, `useUpdateRouter`, `useDeleteRouter`, `useMigrateRouters`, `useTestRouterConnection`

#### `features/ppp/`
```
features/ppp/
├── api/
│   ├── service.ts                    NEW
│   ├── queries.ts                    NEW
│   └── sse.ts                        NEW — usePPPSecretsStream, usePPPActiveStream, usePPPInactiveStream
└── data/
    └── schema.ts                     NEW — PPPSecret, PPPActive, PPPInactive schema
```

Hooks: `usePPPSecrets`, `usePPPActive`, `usePPPInactive`, `usePPPInactiveCount`, `usePPPProfiles`, `useAddPPPSecret`, `useUpdatePPPSecret`, `useRemovePPPSecret`, `useDisconnectPPPActive`

#### `features/network/`
```
features/network/
├── api/
│   ├── service.ts                    NEW
│   ├── queries.ts                    NEW
│   └── sse.ts                        NEW — useDHCPLeasesStream
└── data/
    └── schema.ts                     NEW — Pool, Queue, NATRule, DHCPLease schema
```

Hooks: `useNetworkPools`, `useNetworkQueues`, `useNATRules`, `useDHCPLeases`, `useReleaseDHCPLease`

#### `features/system/`
```
features/system/
├── api/
│   ├── service.ts                    NEW
│   ├── queries.ts                    NEW
│   └── sse.ts                        NEW — useSystemResourceStream
└── data/
    └── schema.ts                     NEW — SystemResource, Scheduler, Script schema
```

Hooks (query): `useSystemResource`, `useSystemResourceHistory`, `useSystemClock`, `useSystemIdentity`, `useRouterboard`, `useExpireMonitor`, `useSchedulers`, `useScripts`, `useSystemDashboard`  
Hooks (mutation): `useRebootRouter`, `useShutdownRouter`, `useDeployExpireMonitor`, `useRemoveExpireMonitor`, `useCreateScheduler`, `useUpdateScheduler`, `useDeleteScheduler`, `useEnableScheduler`, `useDisableScheduler`, `useCreateScript`, `useUpdateScript`, `useDeleteScript`, `useRunScript`, `useSetupLogging`

#### `features/tenant/` (self-management)
```
features/tenant/
└── api/
    ├── service.ts                    NEW
    └── queries.ts                    NEW — useTenantSelf, useTenantSettings, useUpdateTenantName, useUpdateTenantSettings, useUploadTenantLogo
```

---

## Bagian E — SSE: Catatan Khusus Auth

`EventSource` tidak support custom header. Dua opsi:

| Opsi | Cara | Trade-off |
|---|---|---|
| **A. Cookie** | Backend set `HttpOnly` cookie saat login | Paling aman, tidak expose token di URL |
| **B. Query param** | `?access_token=<jwt>` | Token terekspos di log server/proxy |

**Rekomendasi**: diskusikan dengan backend. Jika opsi A, pastikan cookie di-set saat `/auth/login`. Sampai keputusan final, SSE hooks bisa ditulis dengan placeholder:

```ts
// sse.ts
const url = new URL(`${BASE_URL}/routers/${routerId}/sse/hotspot/active`)
// TODO: ganti dengan cookie auth setelah backend support
url.searchParams.set('access_token', useAuthStore.getState().auth.accessToken)
```

---

## Bagian F — File `.env.example`

Tambah ke `web/.env.example`:

```env
VITE_API_URL=http://localhost:8080
```

---

## Bagian G — Urutan Implementasi

### Fase 0 — Infrastruktur (prerequisite semua)
1. `src/lib/api/client.ts`
2. `src/lib/api/types.ts`
3. `src/lib/api/errors.ts`
4. `src/lib/api/query-keys.ts`
5. Update `AuthUser` shape di `auth-store.ts`
6. `web/.env.example`

### Fase 1 — Auth
1. `features/auth/api/service.ts` + `queries.ts`
2. Update `user-auth-form.tsx` → hapus mock, pakai `useLogin`
3. Wire `role-mock-store` dari JWT role setelah login

### Fase 2 — Hotspot (migrasi store, satu per satu)
Urutan: `users` → `profiles` → `active` → `hosts`

Untuk setiap sub-domain:
1. Buat `api/service.ts`
2. Buat `api/queries.ts`
3. Update `data/schema.ts` (tambah API schema, pertahankan UI schema)
4. Ganti `useXxxStore` di komponen
5. Hapus file store

### Fase 3 — Voucher + Quick-Print + Templates (migrasi store)
- `voucher/print/api/` → hapus `quick-print-presets-store`
- `admin/templates/api/` → hapus `global-templates-store`
- `voucher/sales/api/` → hapus `voucher-sales-store`

### Fase 4 — Admin (Tenants + Users)
- `admin/tenants/api/` → hapus `tenants-store`
- `users/api/`

### Fase 5 — Feature baru (langsung TanStack Query, tanpa Zustand)
Urutan: `routers/` → `report/` → `traffic/` → `log/` → `system/` → `ppp/` → `network/`

### Fase 6 — Hotspot lanjutan (belum ada UI)
`bindings/` → `walled-garden/` → `inactive/` → `servers/` → `cookies/` → `profile-mappings/`

### Fase 7 — SSE Streams
Setelah semua REST stabil dan keputusan auth SSE sudah ada.

---

## Checklist Per `api/` Folder

Sebelum dianggap selesai untuk satu domain:

- [ ] `service.ts` — semua fungsi axios, return type explicit
- [ ] `queries.ts` — semua `useQuery` + `useMutation` hooks
- [ ] `query-keys.ts` — keys domain ini sudah terdaftar di `src/lib/api/query-keys.ts`
- [ ] Schema di `data/schema.ts` sudah match response API
- [ ] Komponen tidak lagi import store yang dihapus
- [ ] `onSuccess` di mutation memanggil `invalidateQueries` dengan prefix yang benar
- [ ] Error handling pakai `parseAPIError` dari `src/lib/api/errors.ts`
