# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

See also [AGENTS.md](AGENTS.md) for backend business-layer conventions (store/service/handler patterns, naming, PR checklist).

---

## Commands

### Backend (Go)
```bash
make run          # Run backend locally (reads .env)
make dev          # Run backend + frontend together (Ctrl+C stops both)
make build        # go build ./...
make test         # go test ./...
make test-race    # go test -race ./...
make lint         # golangci-lint run ./...
make tidy         # go mod tidy

# Single test
go test ./api/handler/... -run TestName -v

# Integration tests (requires a connected MikroTik router at localhost:8728)
make test-integration
ROSLIB_ROUTER_ADDRESS=localhost:8728 make test-integration-full
```

### Frontend (run from `web/`)
```bash
pnpm dev          # Vite dev server → http://localhost:5173
pnpm build        # TypeScript check + production bundle
pnpm lint         # ESLint
pnpm format       # Prettier write
pnpm test         # Vitest headless browser
pnpm test:watch   # Watch mode
pnpm knip         # Detect dead exports / unused code
```

### Docker & infrastructure
```bash
make setup        # First-time: generate .env, JWT_SECRET, crypto key
make up-dev       # Start full dev stack (Postgres + InfluxDB + backend + Vite)
make down-dev
make influx-token # Create InfluxDB admin token and write to .env
make openapi-bundle       # Bundle multi-file spec → docs/openapi/openapi.bundle.yaml
make openapi-bundle-check # CI: fail if bundle is out of sync with source
```

---

## Architecture Overview

### Backend (Go monolith)

```
cmd/server/main.go   → DI wiring; starts HTTP server + cron jobs
api/
  deps.go            → Deps struct with all stores, services, config
  routes.go          → RegisterRoutes: three auth zones
  handler/           → thin HTTP handlers — parse, delegate to service, serialize
  dto/               → Request + Response structs with gin binding tags
  middleware/        → RequireAuth, RequireRole, RequireCustomerAuth, rate limit
  sse/               → Server-Sent Events hub (capped per-topic / per-device)
service/             → business logic (no HTTP, no DB queries)
  auth/              → JWT sign/verify, user CRUD, bcrypt
  billing/           → invoice generation, payment reconciliation
  devmgr/            → MikroTik device connection pool
  notification/      → WhatsApp (whatsmeow embedded) + Telegram abstraction
  payment/           → Xendit adapter + webhook processing
  portal/            → customer self-service logic
store/               → DB access only via GORM (interface + private impl)
  model/             → GORM models
  migrate.go         → AutoMigrate + seed system settings (no goose)
job/                 → idempotent background jobs
  outbox.go          → polls DB for pending_* sync, applies to MikroTik (SKIP LOCKED)
  billing_cron.go    → daily invoice generation
  suspension_check.go → isolir/suspend overdue subscriptions
  notif_retry.go     → retry failed notifications
domain/              → pure value types, no I/O (VoucherSpec, Charset, etc.)
workflows/           → multi-step MikroTik sequences (voucher generate, etc.)
mikrotik/            → MikroTik Routeros API client (stable, do not modify)
```

**Request flow:** `HTTP → handler (parse) → service (logic) → store (DB)`.
MikroTik mutations write to DB first (`mikrotik_sync_status = pending_*`), return HTTP 200, then `job/outbox.go` syncs in background — never synchronous in a handler.

**Auth zones in `api/routes.go`:**
- **Public:** `/auth/login`, `/auth/refresh`, `/public/webhooks/xendit`, MikroTik on-login hook
- **Staff:** Bearer JWT (`middleware.ClaimsFrom(c)`) — roles admin > operator > viewer
- **Customer portal:** separate JWT (`middleware.RequireCustomerAuth`) — all `/api/v1/customer/*`

**Response envelope** (`api/handler/helpers.go`):
```go
WriteOK(c, data)            // {"data": data}
WriteList(c, items, total)  // {"data": items, "total": total}
WriteErr(c, err)            // {"error": {...}}
WriteValidationErr(c, err)
```

**SystemSetting key-value table** — all runtime-configurable values (billing grace days, isolir profile name, Xendit keys, etc.) live in `system_setting` rows, accessed via `store.SettingStore`. Groups: `billing.*`, `notification.*`, `payment.*`, `backup.*`, `general.*`. Never hardcode these values in code.

---

### Frontend (React SPA in `web/`)

**Stack:** React 19, TypeScript, Vite, TanStack Router (file-based), TanStack Query, shadcn/ui, Tailwind, Zustand, react-hook-form + Zod.

```
web/src/
  routes/              → file-based routing (TanStack Router)
    index.tsx          → "/" → public LandingPage
    _authenticated/    → auth guard (checks accessToken in beforeLoad); wraps AuthenticatedLayout
      dashboard.tsx    → /dashboard
      settings/        → /settings/* (account, appearance + system config tabs)
      admin/           → /admin/* (users, routers, audit logs, whatsapp)
      hotspot/ ppp/ voucher/
    portal/            → customer portal (separate JWT, separate layout)

  features/            → co-located feature modules
    <feature>/
      index.tsx         → page component
      api/
        service.ts      → async functions using apiClient (unwrap envelope)
        queries.ts      → useQuery / useMutation hooks
        schema.ts       → Zod schemas matching backend wire format
      components/       → UI components
      data/
        schema.ts       → frontend-only Zod types (form schema, view models)
        data.ts         → static option arrays, constants (NO mock/seed data)

  components/
    ui/                → shadcn/ui primitives (auto-generated, do not edit)
    layout/
      data/sidebar-data.ts → nav structure; Dashboard url = "/dashboard"
    password-input.tsx → reusable show/hide password field
    ui/input-group.tsx → InputGroup + InputGroupAddon + InputGroupInput

  lib/api/
    client.ts          → axios instance; baseURL = VITE_API_URL/api/v1; auto-injects Bearer token
    portal-client.ts   → separate axios for customer portal
    query-keys.ts      → centralized qk.* factory (use for all queryKey arrays)
    unwrap.ts          → unwrap(res.data): throws ApiError on error envelope

  stores/
    auth-store.ts           → staff JWT (access + refresh tokens, persisted)
    active-router-store.ts  → currently selected router ID (useActiveRouterId())
    portal-auth-store.ts    → customer JWT
```

**Per-feature API pattern:**
```ts
// service.ts
export async function listItems(routerId: number): Promise<Item[]> {
  const res = await apiClient.get<Envelope<Item[]>>(`/devices/${routerId}/items`)
  return unwrap(res.data)
}
// queries.ts
export function useItems(routerId: number) {
  return useQuery({
    queryKey: qk.items(routerId),
    queryFn: () => svc.listItems(routerId),
    enabled: routerId > 0,  // always gate on routerId > 0
  })
}
```

**Router-scoped data:** MikroTik endpoints are `/devices/:device_id/*`. Active router from `useActiveRouterId()`. Gate queries with `enabled: routerId > 0`.

**Settings system:** All backend system settings tabs share `useSystemSettings()` and `useUpdateSetting()` from `src/features/settings/api/queries.ts`. They call `GET /settings` (returns `SystemSetting[]`) and `PUT /settings/:key`.

---

## Critical Implementation Notes

### Backend
- `service/*` must not import `gin` — business logic is HTTP-agnostic.
- `store/*` must not contain business logic — DB access only.
- All jobs must be idempotent (DB unique constraints as guard).
- Use `NowFunc func() time.Time` in service Deps (not `time.Now()` directly) for testability.
- Every subscription/invoice/payment status change must emit an audit log via `audit.Log()`.
- Never log or return passwords in normal list/detail DTOs or in any log entry. **Exception:** dedicated *reveal* endpoints gated by `RequireRole(admin, operator)` may return a plaintext password (`GET /customers/:id/portal-password`, `GET /subscriptions/:id/password`, `GET /devices/:id/ppp/secrets/:id/password`, `GET /devices/:id/hotspot/users/:id/password`). These are the only places a password leaves the backend, and the plaintext is never written to audit/app logs.
- Customer portal password is stored **AES-encrypted at rest** (column `portal_password`, encrypt/decrypt transparently in `store/customer_store.go` via `encryptSecret`/`decryptSecret`) — same reversible scheme as `Subscription.MikrotikPassword`. It is **not** bcrypt; login compares the decrypted value (`crypto/subtle.ConstantTimeCompare`).
- New models: update `store/migrate.go` in the same commit (AutoMigrate, not goose).

### Frontend
- **No hardcoded server names** (`HS-01`, etc.) — always fetch from `GET /devices/:id/hotspot/servers` via `useHotspotServers(routerId)` (`src/features/voucher/generate/api/queries.ts`).
- **data/data.ts files** must contain only static options and helper functions — no faker, seed arrays, or mock objects.
- **Form field names must match backend binding tags exactly.** For voucher generation: `batch_size`, `length`, `charset`, `user_mode` (not `qty`, `name_length`, `char_set`, `user_type`).
- **MikroTik charset values:** `lower`, `upper`, `mixed`, `number`, `lower_number`, `upper_number`, `mixed_number`.
- Use `PasswordInput` (`@/components/password-input`) for any password/secret field with show/hide toggle.
- Use `InputGroup`/`InputGroupAddon`/`InputGroupInput` (`@/components/ui/input-group`) for input+unit combos (e.g., data limit + MB/GB).
- Use `ContentSection` (`features/settings/components/content-section`) for settings page layout.
- Prefer `Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage` from shadcn for all forms.
