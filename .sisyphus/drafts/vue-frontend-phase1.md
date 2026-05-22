# Draft: Vue.js Frontend Phase 1 — Persiapan

## Requirements (confirmed)
- **Stack**: Vue 3 (Composition API + `<script setup>`), Vite, TypeScript v5.3+, Tailwind CSS v4, vue-router v4, @tanstack/vue-query, Pinia, Axios
- **Folder structure**: User-specified convention (pages/, composables/, queries/, services/, stores/, components/, layouts/, router/, types/, utils/, plugins/, assets/)
- **Components sub-structure**: ui/ (generic base), common/ (shared app-specific), per-feature folders
- **Phase 1 focus**: Persiapan — scaffolding, config, dependencies, base structure only
- **API reference**: OpenAPI spec in docs/openapi/
- **UI reference**: Prototype in website/prototype/

## Existing State (from website/ exploration)
- **package.json**: Vue 3.5.34, TanStack vue-form/query/table/virtual, Chart.js 4.5, Vite 8, Tailwind CSS 4.3, TypeScript 6, vue-tsc 3.2 — **MISSING**: vue-router, Pinia, Axios
- **vite.config.ts**: Minimal (only @vitejs/plugin-vue) — **MISSING**: aliases (@/), proxy to Go backend, env prefix
- **tsconfig.json**: References tsconfig.app.json + tsconfig.node.json — **NEEDS**: path aliases
- **src/**: Only default Vite template files (App.vue, main.ts, style.css, HelloWorld.vue, assets/)
- **No Tailwind config file** — TW v4 uses CSS-first config in style.css with @import "tailwindcss"
- **No PostCSS config** — TW v4 includes PostCSS plugin natively
- **style.css**: Default Vite template styles (irrelevant, will be replaced)
- **index.html**: Default template with `<div id="app">`
- **public/**: favicon.svg, icons.svg

## Technical Decisions
- Vue 3 Composition API with `<script setup>` (user mandate)
- Tailwind CSS v4 — uses CSS-first config via `@import "tailwindcss"` + `@theme` directive (no tailwind.config.ts needed)
- @tanstack/vue-query for server state, Pinia for client state only
- Queries separated from services (queries/ = tanstack wrappers, services/ = raw axios calls)
- Types derived from OpenAPI schemas
- Axios instance configured in plugins/ with interceptors for auth (JWT bearer), error envelope unwrapping
- Vite dev proxy to Go backend (localhost:8080)

## OpenAPI API Surface (from docs/openapi/)

### Authentication
- `POST /auth/login` → access + refresh JWT
- `POST /auth/refresh` → rotate tokens
- `POST /auth/logout` → revoke refresh
- `GET /auth/me` → current user
- CRUD `/auth/users` → admin only user management
- JWT Bearer auth, RBAC: admin/operator/viewer

### Devices (no device_id prefix)
- `GET /devices` → list all
- `POST /devices` → create
- `GET/PUT/DELETE /devices/{id}` → CRUD

### Hotspot (under /devices/{device_id}/...)
- **Servers**: GET list, GET by-name
- **Active**: GET list, GET count, GET by-id, DELETE (kick)
- **Users**: GET list, POST create, GET count, GET by-id, PUT update, DELETE remove, POST disable
- **Profiles**: GET list, POST create, GET by-name, GET by-id, PUT update, DELETE remove
- **Bindings**: GET list, POST create, GET by-id, PUT update, DELETE remove, POST disable
- **Hosts**: GET list
- **Cookies**: GET list, DELETE by-id
- **Vouchers**: POST generate (batch)

### Network
- **Interfaces**: GET list
- **Pools**: GET list, POST create, GET by-name, PUT update, DELETE remove
- **ARP**: GET list
- **DHCP Leases**: GET list
- **Queues**: GET list (simple queues)

### PPP
- **Secrets**: GET list, POST create, GET by-name, GET by-id, PUT update, DELETE remove
- **Profiles**: GET list
- **Active**: GET list, DELETE (kick)

### System
- **Identity**: GET, PUT
- **Resource**: GET (CPU/mem/HDD)
- **Routerboard**: GET
- **Clock**: GET
- **Scripts**: GET list, POST create, GET by-name, GET by-id, PUT, DELETE
- **Schedulers**: GET list, POST create, GET by-id, PUT, DELETE
- **Reboot/Shutdown**: POST control

### Streaming (SSE)
- `/stream/hotspot/active` — active sessions
- `/stream/hotspot/users` — user table changes
- `/stream/hotspot/inactive` — derived inactive users
- `/stream/hotspot/active/count` — active count
- `/stream/hotspot/users/count` — user count
- `/stream/system/resource` — CPU/mem/HDD
- `/stream/network/interfaces/traffic` — interface traffic
- `/stream/network/queues/stats` — queue stats

### History (InfluxDB)
- `/history/resource` — CPU/mem/HDD time series
- `/history/interfaces` — traffic time series
- `/history/hotspot/users` — user usage time series
- `/history/hotspot/users/summary` — usage summary

### Reports (Postgres, works offline)
- `/reports/selling` — transaction list
- `/reports/selling/today` — today's summary
- `/reports/selling/summary` — monthly aggregate
- `/reports/selling/export` — CSV export

### Profile Configs (DB-backed, works offline)
- GET list, GET by-profile, PUT upsert

### Health
- `GET /healthz` — no auth required

### Response Envelope
- Success single: `{ data: {...} }`
- Success list: `{ data: [...], meta: { count: N } }`
- Error: `{ error: { code: "...", message: "...", path: "..." } }`
- Error codes: NOT_FOUND, INVALID_ARGUMENT, AMBIGUOUS, VALIDATION, TIMEOUT, CANCELED, INTERNAL, DEVICE_NOT_FOUND, SERVICE_UNAVAILABLE

## Prototype Pages (from website/prototype/)

### Layout
- **Dark theme default**, light theme variant (CSS vars + data-theme attribute)
- **Sidebar** (collapsible, expanded/mini modes) with nav items
- **Top bar** with device selector, search, theme toggle
- Color palette: Cyan (#22D3EE), Violet (#8B5CF6), Lime (#A3E635) accents

### Screens (9 pages matching sidebar nav)
1. **Overview** — KPI cards (active sessions, users, revenue, uptime), charts (voucher sales, traffic), recent sessions, active alerts
2. **Hotspot Users** — Data table with search/filter, CRUD actions, status badges
3. **Voucher** — Batch generate form, voucher list/grid with print
4. **Sessions** — Active sessions table, kick action, live updates
5. **Profiles** — Profile list/grid, CRUD, rate limit display
6. **PPP** — PPP secrets table, active connections, kick
7. **Network** — Interfaces list, traffic chart, IP pools, ARP, DHCP leases
8. **Reports** — Sales summary, transaction table, export, monthly chart
9. **System** — Identity, resource gauges, routerboard info, scripts, schedulers

### Shared UI Components (from prototype)
- **KpiCard** — metric card with sparkline
- **DataTable** — sortable, filterable, paginated table
- **Card** — container with title/actions
- **Badge** — status indicator (cyan/violet/lime tones)
- **Segmented** — toggle control
- **StatusDot** — online/offline/warn indicator
- **Icon set** — SVG stroke icons (Home, Users, Ticket, Wifi, Activity, etc.)
- **TweaksPanel** — theme/density/card style controls
- **Modal/Drawer** — for forms
- **SearchBar** — global search
- **DeviceSelector** — dropdown for multi-router

### Design Tokens (from prototype styles.css)
- Fonts: Geist (sans), JetBrains Mono (mono)
- Radii: sm(6), default(10), lg(14), xl(18)
- Density: regular/compact/comfy
- Card styles: flat/elevated/bordered
- Dark palette: bg #0B1220, bg-1 #0E162A, bg-2 #131D36, bg-3 #1A2747
- Light palette: bg #F4F6FB, bg-1 #FFFFFF

## Go Backend Server
- Entry point: `cmd/server/main.go`
- HTTP bind from env `HTTP_BIND` (default `:8080`)
- API base: `/api/v1`
- CORS: configured via `CORS_ALLOWED_ORIGINS` env
- SSE hub with subscriber cap
- Auth: JWT (HS256), access 15m, refresh 7d
- Rate limiting per user (60rpm) and per IP for anon (20rpm)

## Scope Boundaries
- INCLUDE Phase 1: Project scaffolding, config files, dependency installation, folder structure, base layout shell, design tokens, type definitions from OpenAPI, Axios instance, vue-query client, vue-router setup, Pinia setup, auth store skeleton
- EXCLUDE: Actual page implementations, feature components, API integration logic, SSE handling — those are Phase 2+

## Test Strategy Decision
- **Infrastructure exists**: NO (Vite template only)
- **Automated tests**: YES (after) — Vitest setup in Phase 1, tests written alongside features in later phases
- **Agent-Executed QA**: ALWAYS

## Clearance Check
- [x] Core objective clearly defined: Phase 1 scaffolding for Vue.js frontend
- [x] Scope boundaries established: IN = scaffolding/config/base structure, OUT = feature implementation
- [x] No critical ambiguities: User specified exact stack and folder structure
- [x] Technical approach decided: Based on OpenAPI spec + prototype
- [x] Test strategy confirmed: Vitest setup, tests-after for features
- [x] No blocking questions outstanding

→ ALL YES. Ready for plan generation.
