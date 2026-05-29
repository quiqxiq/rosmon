# Roskit Web

Frontend dashboard untuk **Roskit** — platform manajemen MikroTik RouterOS multi-tenant.

## Tech Stack

| Kategori | Library |
|---|---|
| Framework | React 19 + Vite |
| Routing | TanStack Router (file-based) |
| Server State | TanStack Query |
| Client State | Zustand |
| HTTP | Axios |
| Validation | Zod |
| Form | React Hook Form |
| UI | shadcn-admin (ShadcnUI + TailwindCSS + RadixUI) |
| Icons | Lucide Icons, Tabler Icons |

## Prasyarat

- Node.js >= 20
- pnpm
- Backend Roskit berjalan di `http://localhost:8080`

## Setup

```bash
# install dependencies
pnpm install

# copy env
cp .env.example .env
```

Edit `.env`:
```env
VITE_API_URL=http://localhost:8080
```

## Menjalankan

```bash
# development
pnpm dev

# build production
pnpm build

# preview build
pnpm preview
```

## Struktur Folder

```
src/
├── lib/
│   └── api/          ← infrastruktur HTTP shared (axios, query keys, error parser)
├── features/         ← logika per domain (UI + API hooks)
│   ├── auth/
│   ├── hotspot/
│   ├── ppp/
│   ├── network/
│   ├── system/
│   ├── voucher/
│   ├── report/
│   ├── admin/
│   └── ...
├── stores/           ← Zustand, hanya untuk client state (auth, active tenant)
├── components/       ← UI komponen shared
├── hooks/            ← cross-cutting hooks
└── routes/           ← TanStack Router file-based routes
```

Panduan lengkap arsitektur: [`ARCHITECTURE.md`](./ARCHITECTURE.md)  
Panduan integrasi API: [`docs/API_INTEGRATION_PLAN.md`](./docs/API_INTEGRATION_PLAN.md)
