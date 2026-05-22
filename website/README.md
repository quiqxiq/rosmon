# roslib-mikhmon — Frontend

Vue 3 + Vite + TypeScript + Tailwind v4 SPA untuk roslib-mikhmon REST/SSE API.

## Stack

- **Vue 3** Composition API + `<script setup>`
- **Vite 8** build tool
- **TypeScript 6** (strict, path alias `@/*`)
- **Tailwind CSS v4** via `@tailwindcss/vite`
- **vue-router** untuk client routing
- **@tanstack/vue-query** untuk server state
- **Pinia** untuk client state (auth, device, ui — persisted)
- **Axios** HTTP client dengan JWT Bearer + refresh interceptor
- **@vueuse/core** untuk composables (`useEventSource` SSE)

## Scripts

```bash
pnpm dev          # dev server (http://localhost:5173)
pnpm build        # production build
pnpm preview      # serve dist/
pnpm typecheck    # vue-tsc check
pnpm lint         # ESLint
pnpm lint:fix     # ESLint --fix
pnpm format       # Prettier write
pnpm format:check # Prettier verify
```

## Struktur

```
src/
├── pages/         # route-level components
├── layouts/       # AuthLayout, DefaultLayout, BlankLayout
├── router/        # vue-router config + guard auth
├── components/    # ui, common, auth, device, hotspot, ppp, network, system, reports, overview, stream
├── composables/   # useAuth, useActiveDevice, useSSE, useTheme, useToast
├── stores/        # Pinia stores (auth, device, ui)
├── services/      # raw axios calls per resource (mengacu docs/openapi/)
├── queries/       # @tanstack/vue-query hooks per resource
├── types/         # TS types per resource (manual, mengacu docs/openapi/schemas/)
├── utils/         # helper pure (env, format, http-error, validity)
├── plugins/       # axios, vue-query, pinia init
└── assets/        # styles, images
```

## Environment

`.env.local` (opsional):

```
VITE_API_BASE_URL=http://127.0.0.1:8080/api/v1
```

Default fallback `/api/v1` — Vite dev server sudah punya proxy ke `http://127.0.0.1:8080`.

## Referensi

- OpenAPI spec: `../docs/openapi/openapi.bundle.yaml`
- Prototype UI (React JSX, design reference): `./prototype/`
