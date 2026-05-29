# Frontend Architecture Guide

Dokumen ini panduan **wajib** untuk developer yang menambah feature, integrasi API, atau refactor `web/`. Stack: React 19 · Vite · TypeScript · TanStack Router · TanStack Query · Zustand · Axios · Zod · shadcn-admin.

---

## 1. Prinsip Inti

### 1.1. Pisahkan Server State dan Client State

Aturan #1 yang paling sering dilanggar:

| Jenis State | Tools | Contoh | Lokasi |
|---|---|---|---|
| **Server state** — data dari API, bisa stale, bisa di-refetch | **TanStack Query** (`useQuery`/`useMutation`) | hotspot users, profiles, sales, voucher, active sessions, schedulers | `features/<domain>/api/queries.ts` |
| **Client state** — UI/auth/preferences/ephemeral | **Zustand** | auth token, active tenant slug, theme, dialog open, role mock | `stores/*.ts` |

> **Anti-pattern terlarang**: menyimpan response API di Zustand. Itu duplikasi state — TanStack Query sudah punya cache, invalidation, refetch, dedup. Cukup baca `useQuery` di komponen.

### 1.2. Hybrid API Layer

Bukan pilih `src/api/` (terpusat) **vs** `features/<domain>/api/` (per-feature) — gabung keduanya:

- **`src/lib/api/`** = infrastruktur shared (axios, interceptors, error parser, query-key factory).
- **`src/features/<domain>/api/`** = logika domain (endpoint hotspot users, voucher, dst.).

**Aturan kapan ke `lib` vs `features/`**:
- Dipakai 2+ feature → `lib/api/`
- Spesifik 1 domain (endpoint, transform, schema response) → `features/<domain>/api/`

---

## 2. Folder Layout

```
web/src/
├── lib/
│   └── api/                                  ← infra shared (BARU)
│       ├── client.ts                         ← axios instance + interceptors
│       ├── types.ts                          ← Envelope<T>, APIError, PaginationMeta
│       ├── query-keys.ts                     ← key factory (SATU sumber kebenaran)
│       ├── errors.ts                         ← parser error envelope backend → string
│       └── schema.gen.ts                     ← (opsional) generated dari OpenAPI
├── features/
│   └── hotspot/
│       └── users/
│           ├── api/                          ← logika domain (BARU)
│           │   ├── service.ts                ← fungsi axios pure (opsional)
│           │   └── queries.ts                ← useHotspotUsers, useCreateHotspotUser, dst.
│           ├── components/                   ← UI components feature-scoped
│           ├── data/
│           │   ├── data.ts                   ← seed mock (BOLEH tetap untuk dev/test)
│           │   └── schema.ts                 ← Zod schema = sumber type response
│           ├── dialogs/
│           ├── lib/                          ← helper feature-scoped
│           ├── store/                        ← (opsional) Zustand UI-state khusus feature
│           └── index.tsx                     ← entry route
├── stores/                                   ← HANYA client state global
│   ├── auth-store.ts                         ✓ token = client state
│   ├── active-tenant-store.ts                ✓ slug = client state
│   ├── role-mock-store.ts                    ✓ UI mock = client state
│   └── hotspot-*-store.ts                    ✗ HAPUS (server state → TanStack Query)
├── hooks/                                    ← cross-cutting hooks
├── lib/                                      ← utilities umum (cookies, format, dst.)
└── routes/                                   ← TanStack Router file-based
```

---

## 3. `lib/api/client.ts` — Axios Instance

Tanggung jawab:
1. `baseURL` dari env (`VITE_API_URL`).
2. Inject `Authorization: Bearer <token>` dari `useAuthStore`.
3. Inject `X-Tenant-Slug: <slug>` dari `useActiveTenantStore`.
4. Unwrap response envelope `{ data, error }` (opsional, atau biarkan handler yang unwrap).
5. Interceptor error: 401 → `auth.reset()` + redirect (sudah ditangani di `main.tsx`, tapi bisa di sini juga).

**Catatan `.env`**: tambah `VITE_API_URL=http://localhost:8080` ke `web/.env.example`.

```ts
// web/src/lib/api/client.ts
import axios, { type AxiosInstance } from 'axios'
import { useAuthStore } from '@/stores/auth-store'
import { useActiveTenantStore } from '@/stores/active-tenant-store'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().auth.accessToken
  const slug = useActiveTenantStore.getState().slug
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (slug) config.headers['X-Tenant-Slug'] = slug
  return config
})
```

> **Jangan** buat instance axios baru di per-feature. Selalu import `apiClient` ini.

---

## 4. `lib/api/types.ts` — Tipe Shared

Mapping ke backend `pkg/httpresp/respond.go`:

```ts
// web/src/lib/api/types.ts
export type Envelope<T> = { data: T | null; error: string | null }

export type APIError = {
  status: number
  message: string
  detail?: unknown
}

export type PaginationMeta = {
  page: number
  per_page: number
  total: number
  total_pages: number
}

export type Paginated<T> = { items: T[]; meta: PaginationMeta }
```

---

## 5. `lib/api/query-keys.ts` — Key Factory

**Wajib** terpusat. Mencegah typo dan inkonsistensi saat invalidate.

```ts
// web/src/lib/api/query-keys.ts
export const qk = {
  // hotspot
  hotspotUsers: (routerId: number, filters?: object) =>
    ['hotspot', 'users', routerId, filters ?? {}] as const,
  hotspotUser: (routerId: number, userId: string) =>
    ['hotspot', 'users', routerId, userId] as const,
  hotspotProfiles: (routerId: number) =>
    ['hotspot', 'profiles', routerId] as const,
  hotspotActive: (routerId: number) =>
    ['hotspot', 'active', routerId] as const,

  // voucher / sales
  voucherSales: (routerId: number, filters?: object) =>
    ['voucher', 'sales', routerId, filters ?? {}] as const,
  voucherSession: (gencode: string) =>
    ['voucher', 'session', gencode] as const,

  // tenant / admin
  tenants: (filters?: object) => ['tenants', filters ?? {}] as const,
  tenant: (id: string) => ['tenants', id] as const,

  // system
  systemDashboard: (routerId: number) =>
    ['system', 'dashboard', routerId] as const,
  systemResource: (routerId: number) =>
    ['system', 'resource', routerId] as const,
} as const
```

**Aturan invalidate**:
- Setelah `createHotspotUser` → `invalidateQueries({ queryKey: ['hotspot', 'users', routerId] })` (prefix-match, semua filter ikut ter-invalidate).

---

## 6. `lib/api/errors.ts` — Error Parser

```ts
// web/src/lib/api/errors.ts
import { AxiosError } from 'axios'
import type { Envelope } from './types'

export function parseAPIError(error: unknown): string {
  if (error instanceof AxiosError) {
    const env = error.response?.data as Envelope<unknown> | undefined
    if (env?.error) return env.error
    if (error.message) return error.message
  }
  if (error instanceof Error) return error.message
  return 'Unknown error'
}
```

---

## 7. Pattern Per Feature: `features/<domain>/<sub>/api/`

### 7.1. `service.ts` (opsional, fungsi axios murni)

```ts
// web/src/features/hotspot/users/api/service.ts
import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import type { HotspotUser } from '../data/schema'

export async function listHotspotUsers(routerId: number) {
  const res = await apiClient.get<Envelope<HotspotUser[]>>(
    `/api/v1/routers/${routerId}/hotspot/users`,
  )
  return res.data.data ?? []
}

export async function createHotspotUser(
  routerId: number,
  payload: Partial<HotspotUser>,
) {
  const res = await apiClient.post<Envelope<HotspotUser>>(
    `/api/v1/routers/${routerId}/hotspot/users`,
    payload,
  )
  return res.data.data!
}

export async function deleteHotspotUser(routerId: number, userId: string) {
  await apiClient.delete(`/api/v1/routers/${routerId}/hotspot/users/${userId}`)
}
```

### 7.2. `queries.ts` (TanStack Query hooks)

```ts
// web/src/features/hotspot/users/api/queries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import {
  listHotspotUsers,
  createHotspotUser,
  deleteHotspotUser,
} from './service'

export function useHotspotUsers(routerId: number) {
  return useQuery({
    queryKey: qk.hotspotUsers(routerId),
    queryFn: () => listHotspotUsers(routerId),
    enabled: routerId > 0,
  })
}

export function useCreateHotspotUser(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: Parameters<typeof createHotspotUser>[1]) =>
      createHotspotUser(routerId, payload),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['hotspot', 'users', routerId] }),
  })
}

export function useDeleteHotspotUser(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => deleteHotspotUser(routerId, userId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['hotspot', 'users', routerId] }),
  })
}
```

### 7.3. Pemakaian di komponen

```tsx
import {
  useHotspotUsers,
  useCreateHotspotUser,
} from '@/features/hotspot/users/api/queries'

export function HotspotUsersList({ routerId }: { routerId: number }) {
  const { data: users, isPending, isError, error } = useHotspotUsers(routerId)
  const createUser = useCreateHotspotUser(routerId)

  if (isPending) return <Spinner />
  if (isError) return <ErrorState message={parseAPIError(error)} />

  return (
    <>
      <DataTable data={users} />
      <Button
        onClick={() => createUser.mutate({ name: 'guest', password: '...' })}
        disabled={createUser.isPending}
      >
        Add user
      </Button>
    </>
  )
}
```

> Tidak ada `useHotspotUsersStore` lagi.

---

## 8. Naming Conventions

| Hal | Aturan |
|---|---|
| Query hook | `useXxxYyy` (plural untuk list, singular untuk by-id). Contoh: `useHotspotUsers`, `useHotspotUser` |
| Mutation hook | `useVerbXxx`. Contoh: `useCreateHotspotUser`, `useUpdateRouter`, `useDeleteSale` |
| Service fn | verb + noun. Contoh: `listHotspotUsers`, `getHotspotUser`, `createHotspotUser`, `removeHotspotUser` |
| Query key | array `[domain, resource, routerId, filters?]` — dari factory `qk` |
| Schema | Zod export `XxxSchema`, type export `Xxx` |
| File | kebab-case: `queries.ts`, `service.ts`, `schema.ts` |

---

## 9. Form + Mutation Pattern (React Hook Form + Zod + Mutation)

```tsx
const form = useForm<HotspotUserForm>({
  resolver: zodResolver(HotspotUserCreateSchema),
  defaultValues: { name: '', password: '', profile: 'default' },
})

const createUser = useCreateHotspotUser(routerId)

const onSubmit = form.handleSubmit((values) => {
  createUser.mutate(values, {
    onSuccess: () => {
      toast.success('User created')
      form.reset()
      onClose()
    },
    onError: (err) => toast.error(parseAPIError(err)),
  })
})
```

`onError` global di `main.tsx` sudah handle 401/500 — di sini hanya tampilkan domain error.

---

## 10. SSE / Real-time

Backend punya banyak SSE endpoint (telemetry, log). Untuk SSE **jangan** pakai TanStack Query langsung — pakai pattern dedicated:

```
features/<domain>/api/sse.ts          ← buka EventSource, parse event, push ke query cache
```

Pola umum:

```ts
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'

export function useHotspotActiveStream(routerId: number) {
  const qc = useQueryClient()
  useEffect(() => {
    const es = new EventSource(
      `${import.meta.env.VITE_API_URL}/api/v1/routers/${routerId}/hotspot/active/stream`,
      { withCredentials: true },
    )
    es.addEventListener('hotspot_active', (ev) => {
      const payload = JSON.parse(ev.data)
      qc.setQueryData(qk.hotspotActive(routerId), payload)
    })
    return () => es.close()
  }, [routerId, qc])
}
```

> SSE = "push update" ke cache query existing. Komponen tetap baca via `useQuery` biasa.

---

## 11. Migrasi Stores Existing

Ini daftar audit untuk `web/src/stores/`:

| File | Jenis | Aksi |
|---|---|---|
| `auth-store.ts` | Client state | **TETAP** |
| `active-tenant-store.ts` | Client state | **TETAP** |
| `role-mock-store.ts` | Client state (UI mock) | **TETAP** sementara, hapus saat backend RBAC siap |
| `hotspot-users-store.ts` | Server state + seed | **HAPUS** → `useHotspotUsers` (TanStack Query). Seed pindah ke `data/data.ts` (tetap dipakai untuk Storybook/test) |
| `hotspot-active-store.ts` | Server state + seed | **HAPUS** → `useHotspotActive` |
| `hotspot-hosts-store.ts` | Server state + seed | **HAPUS** → `useHotspotHosts` |
| `hotspot-profiles-store.ts` | Server state + seed | **HAPUS** → `useHotspotProfiles` |
| `voucher-sales-store.ts` | Server state + seed | **HAPUS** → `useVoucherSales` |
| `quick-print-presets-store.ts` | Server state + seed | **HAPUS** → `useQuickPrintPresets` |
| `tenants-store.ts` | Server state + seed | **HAPUS** → `useTenants` |
| `global-templates-store.ts` | Server state + seed | **HAPUS** → `useGlobalTemplates` |

**Strategi migrasi bertahap**:
1. Tambah `lib/api/{client,types,query-keys,errors}.ts` dulu.
2. Migrasi 1 feature paling sederhana (misal `tenants`) dari Zustand → TanStack Query end-to-end. Ini jadi referensi pattern.
3. Setelah pattern terbukti, migrasi feature lain satu per satu.
4. Tiap migrasi: ganti `useXxxStore` → `useXxx` query hook, hapus file store, hapus seed dari store (boleh tetap di `data/data.ts` untuk testing).

> **Jangan** big-bang refactor semua sekaligus — migrasi per-feature agar tetap mergeable.

---

## 12. Optional: Auto-Generate Types dari OpenAPI

Backend punya spec lengkap di `docs/openapi/openapi.yaml`. Bisa generate types TS untuk type-safety end-to-end:

```bash
pnpm add -D openapi-typescript
```

Tambah ke `package.json`:
```json
{
  "scripts": {
    "gen:api": "openapi-typescript ../docs/openapi/openapi.yaml -o src/lib/api/schema.gen.ts"
  }
}
```

Pemakaian:
```ts
import type { components } from '@/lib/api/schema.gen'
type HotspotUser = components['schemas']['HotspotUser']
```

> Run `pnpm gen:api` setelah backend update spec. Nanti bisa hook ke `prebuild` script.

---

## 13. Checklist Saat Tambah Feature Baru

1. ☐ Buat folder `features/<domain>/<sub>/` dengan minimal `index.tsx`, `data/schema.ts`.
2. ☐ Definisi Zod schema di `data/schema.ts` (response API + form payload).
3. ☐ Tambah query key di `lib/api/query-keys.ts` (factory `qk`).
4. ☐ Buat `api/service.ts` dengan fn axios pure.
5. ☐ Buat `api/queries.ts` dengan hooks `useXxx` + `useVerbXxx`.
6. ☐ Pakai hooks di komponen — **jangan** pakai Zustand untuk server data.
7. ☐ Untuk form, gunakan `react-hook-form` + `zodResolver`.
8. ☐ Untuk SSE, buat `api/sse.ts` yang push update ke cache via `qc.setQueryData`.
9. ☐ Test happy path + error path (handleServerError sudah global, tapi error domain harus jelas).
10. ☐ Jangan lupa register route di `routes/` (TanStack Router file-based).

---

## 14. Anti-Patterns yang Wajib Dihindari

| ❌ Jangan | ✅ Lakukan |
|---|---|
| Simpan list data API di Zustand | TanStack Query `useQuery` |
| `axios.get(...)` langsung di komponen | Lewat `service.ts` + hook |
| `axios.create()` baru di feature | Pakai `apiClient` dari `lib/api/client.ts` |
| Hardcode query key string `['hotspot-users']` | `qk.hotspotUsers(routerId)` dari factory |
| `setState` setelah mutate untuk optimistic update | `qc.setQueryData` di `onMutate` (atau `invalidateQueries` di `onSuccess`) |
| Try/catch + setState error di setiap komponen | `parseAPIError(err)` + global error handler |
| Mock seed di Zustand store | Mock seed di `data/data.ts` (atau MSW handlers) |

---

## 15. Quick Reference: 1 Resource End-to-End

Skenario: tambah feature CRUD voucher sales.

```
1. Backend endpoint    : GET/POST/DELETE /api/v1/routers/:id/reports/sales
2. OpenAPI spec        : docs/openapi/paths/report.yaml (sudah ada)
3. Schema              : web/src/features/report/data/schema.ts (Zod)
4. Service             : web/src/features/report/api/service.ts
5. Hooks               : web/src/features/report/api/queries.ts
6. Query keys          : qk.voucherSales(routerId, filters)
7. Component           : web/src/features/report/components/sales-table.tsx
                          → useVoucherSales(routerId, filters)
8. Route               : web/src/routes/_authenticated/report/sales.tsx
9. Mutations           : useDeleteSale, useExportSalesCSV
                          → onSuccess: invalidate ['voucher', 'sales', routerId]
```

Tidak ada Zustand store. Tidak ada axios langsung di komponen. Tidak ada hardcoded query key.

---

**Maintainer note**: jika Anda menemukan kasus yang tidak ter-cover dokumen ini (mis. WebSocket, file upload progress, optimistic UI lanjutan), tambahkan section baru dan link contoh implementasi yang sudah ada — jangan biarkan dokumen jadi stale.
