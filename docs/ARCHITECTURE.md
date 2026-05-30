# Architecture

Diagram dependency layer (panah = "import"):

```text
                         ┌──────────────────────────────┐
                         │  test/integration/ (build:int)│
                         └──────────────┬───────────────┘
                                        ↓
       ┌────────────────────┐    ┌──────────────────┐
       │  workflows/        │ →  │  internal/       │
       │  (cascade orchestr)│    │  testutil/       │
       └────┬───────┬───────┘    └──────┬───────────┘
            │       │                   │
            ↓       ↓                   ↓
   ┌──────────────┐  ┌──────────────┐
   │  scripts/    │  │  mikrotik/   │ ←── (CommandRunner)
   │  (string gen)│  │  + sub-modul │      ↑
   └────┬─────────┘  └────┬─────────┘      │
        │                 │                ┌──────────────┐
        ↓                 ↓                │ mikrotik/fake│
   ┌──────────────┐  ┌──────────────┐      │ (in-mem mock)│
   │  internal/   │  │  internal/   │      └──────────────┘
   │  rosfmt/     │  │  rosfmt/     │
   └──────────────┘  └──────┬───────┘
                            ↓
                     ┌──────────────┐
                     │  domain/     │  (no IO, value types)
                     └──────────────┘
```

## Layer Tanggung Jawab

| Layer | File | Boleh I/O | Boleh import |
|---|---|---|---|
| `domain/` | tipe value-object | ❌ | (nothing) |
| `internal/rosfmt/` | format/parse string RouterOS | ❌ | (nothing) |
| `internal/tcpmock/` | mock TCP server | ❌ (test only) | stdlib |
| `internal/testutil/` | helper integration | ❌ (test only) | mikrotik, roslib |
| `mikrotik/` | thin command wrapper | ✅ via `CommandRunner` | `roslib`, `domain`, `rosfmt` |
| `mikrotik/fake/` | mock CommandRunner | ❌ | mikrotik (parent) |
| `scripts/` | RouterOS script generator | ❌ | `domain`, `rosfmt` |
| `workflows/` | cascade orchestration | ✅ via mikrotik | `mikrotik`, `scripts`, `domain` |

## Mock Seam

Satu interface `mikrotik.CommandRunner`:

```go
type CommandRunner interface {
    Run(ctx context.Context, sentence []string) (Reply, error)
}
```

- Production: `mikrotik.NewRunner(*roslib.Device)` → kirim ke router via async + tag demux.
- Test: `fake.New().On(sentence...).Reply(...)` → record call + scripted reply.
- Edge case (encoding): `internal/tcpmock` → real TCP listener yang verifikasi length-prefix word.

## Kontrak Pemanggilan

Semua method publik di `mikrotik/<modul>` mengikuti pola:

```go
func (c *Client) <Op>(ctx context.Context, <args>) (<typed-result>, error)
```

- `ctx` selalu pertama, `error` selalu terakhir.
- Field opsional di `Args` struct memakai pointer kalau zero-value bermakna (mis. `*int64` untuk `LimitBytesTotal=0` yang berarti unlimited vs unset).
- ID kosong → `mikrotik.ErrInvalidArgument`.
- Lookup ke resource yang tidak ada → `mikrotik.ErrNotFound`.

## Cross-reference ke `mikhmonv3-analisis.md`

Setiap exported function punya doc comment yang menyebut section, mis.

```go
// UserAdd → /ip/hotspot/user/add  (analisis §1.6).
```

Lihat [COMMANDS.md](COMMANDS.md), [SCRIPTS.md](SCRIPTS.md), [WORKFLOWS.md](WORKFLOWS.md) untuk peta lengkap.

## Business Layer (Manajemen ISP)

Di atas wrapper MikroTik, rosmon punya lapisan bisnis dengan pemisahan ketat:

| Layer | Package | Tanggung jawab |
|---|---|---|
| Model + Store | `store/`, `store/model/` | Akses DB (GORM). Interface + impl `gorm*`. **Tanpa** business logic. |
| Service | `service/` | Logika bisnis: `auth`, `billing`, `notification` (+ `whatsapp`), `audit`, `expiry`, `metrics`, `devmgr`. **Tanpa** dependency HTTP. |
| Job | `job/` | Background: `outbox` (sync DB→router tiap 10s), `billing_cron` (07:00), `suspension_check` (09:00), `notif_retry` (5m). Idempotent. |
| HTTP | `api/handler/`, `api/dto/` | Handler tipis + DTO. Tiga zone auth (lihat bawah). |

### Prinsip kunci

- **MikroTik = source of truth operasional.** DB menyimpan *intended state*. Join key tunggal: `MikrotikUsername`.
- **DB-first + outbox.** Mutasi subscription: tulis DB (`sync_status = pending_*`) → kembalikan HTTP response → `job/outbox` sync ke router di background (`FOR UPDATE SKIP LOCKED`). Tetap konsisten walau router offline.
- **Notifikasi hanya via `service/notification`.** `Sender` pluggable (interface) — implementasi `whatsapp.Manager` (whatsmeow embedded, sesi di Postgres). Log + retry wajib.
- **Audit wajib** untuk aksi ubah-status (helper `service/audit`).
- **Konfigurasi dinamis** dari tabel `system_settings`, bukan konstanta hardcoded.

### Zone auth

| Zone | Middleware | Endpoint |
|---|---|---|
| Publik | (none) + IP rate-limit | `POST /public/registrations`, webhook on-login |
| Staff | `RequireAuth` + `RequireRole` | `/api/v1/*` — admin > operator > viewer |
| Customer | `RequireCustomerAuth` *(roadmap Fase 3)* | `/api/customer/*` |

### Dependency injection

`cmd/server/main.go` mem-build semua store + service + job, lalu inject ke `api.Deps` (nil-guarded — fitur opsional di-skip kalau dep nil). Tanpa framework DI.

Desain lengkap & roadmap: [../goal.md](../goal.md), [../roadmap.md](../roadmap.md), [../system-design.md](../system-design.md).
