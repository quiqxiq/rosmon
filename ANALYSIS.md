# Analisis `roslib` + `rosmon`

Dokumen onboarding + review gap/improvement untuk dua project: library RouterOS API
(`roslib`) dan aplikasi Mikhmon-as-a-Service Go (`rosmon`). Disusun setelah
membaca seluruh kode produksi tanpa run-test, jadi finding di Bagian 3 perlu
divalidasi via integration test sebelum diperbaiki.

---

## Bagian 1 — Onboarding

### 1.1 Hubungan dua project

```
┌────────────────────────────────────────────────────────────────┐
│  roslib  (library, single binary independent)                  │
│  ─ Wrapper github.com/go-routeros/routeros/v3                  │
│  ─ Tag-based multiplex: 2 koneksi async per router fisik       │
│    (stream + command), supervisor + auto-reconnect             │
│  ─ Builder chain: dev.Path(p).Print().Where(k,v).Exec(ctx)     │
│  ─ Streaming (.Stream), polling (RegisterPoll), cache, influx  │
└────────────────────────────────────────────────────────────────┘
                            ▲
                            │ replace github.com/quiqxiq/roslib => ../
                            │ (go.mod local replace)
                            │
┌────────────────────────────────────────────────────────────────┐
│  rosmon  (aplikasi)                                    │
│  ─ HTTP (gin) + SSE + Postgres (gorm) + InfluxDB3 history      │
│  ─ Multi-router (devmgr) + per-device goroutine expiry checker │
│  ─ Workflows cascade (mikhmonv3 §4 — DeleteUser dst)            │
└────────────────────────────────────────────────────────────────┘
```

### 1.2 Arsitektur layer

```
                ┌────────────────────────────────────────┐
                │  HTTP & SSE (gin)                      │
                │  api/handler/* — tipis, only mapping   │
                │  api/sse/Hub + Broker — fan-out 1:N    │
                └──────────────┬─────────────────────────┘
                               │ DeviceMiddleware
                               │ inject ClientSet ke gin.Context
                               ▼
                ┌────────────────────────────────────────┐
                │  Services (long-running goroutines)    │
                │  ─ devmgr.Manager   — koneksi router   │
                │  ─ expiry.Service   — 1 checker/device │
                │  ─ metrics.Service  — streams → influx │
                └──────────────┬─────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        ▼                      ▼                      ▼
┌──────────────┐      ┌──────────────────┐    ┌────────────────┐
│ mikrotik/*   │      │ workflows/*      │    │ store/*        │
│ Thin clients │      │ Cascade orders   │    │ gorm postgres  │
│ ─ hotspot    │      │ (DeleteUser …)   │    │ ─ Device       │
│ ─ system     │      │                  │    │ ─ Transaction  │
│ ─ network    │      │                  │    │ ─ Profile cfg  │
│ ─ ppp        │      │                  │    │ ─ User (stub)  │
│ ─ syslog     │      │                  │    └────────────────┘
└──────┬───────┘      └──────────────────┘
       │
       ▼
┌──────────────┐
│ roslib.Device │  (per device, 2 koneksi persisten + supervisor)
└──────────────┘
```

### 1.3 Peta package

| Path | Tanggung jawab | Dependencies kunci |
|---|---|---|
| `cmd/server/main.go` | Entry HTTP API; wiring config → DB → services → handler. | semua package internal |
| `api/server.go` | Gin engine bootstrap (NoRoute, healthz, register routes). | gin, dto |
| `api/routes.go` | Mount handler di `/api/v1/devices/:device_id/*`. | semua handler |
| `api/deps.go` | Struct `Deps` (DI container manual). | logrus, gorm, devmgr, sse |
| `api/clientctx.go` | Helper `MustClients(c)` baca `ClientSet` dari gin ctx. | devmgr |
| `api/middleware/*` | Recovery, RequestID, Logger, CORS, DeviceMiddleware. | gin, logrus, dto |
| `api/handler/*` | Per-resource handler tipis. Pattern `Register(g)`. | mikrotik/*, workflows, dto |
| `api/dto/*` | Request/response DTO + mapper FromDomain/ToArgs. | domain |
| `api/sse/*` | Hub (registry topic→Broker), Broker (fan-out + refcount), writer SSE protocol. | gin |
| `service/devmgr` | Manager koneksi router (`active map[deviceID]*ClientSet`), hook lifecycle. | roslib, mikrotik/*, store, workflows |
| `service/expiry` | Per-device goroutine yang parse comment expiry user, eksekusi mode (rem/ntf/remc/ntfc), record transaksi ke DB. | devmgr, store, workflows |
| `service/metrics` | Streams system_resource, interface_stats, hotspot_user_*, hotspot_active, ppp_active, queue_stats → InfluxDB3. | influxdb3, devmgr |
| `mikrotik/*` | Thin sub-client per modul (hotspot, system, network, ppp, syslog). Per-resource file + `_stream.go` + `monitor.go`. | roslib |
| `workflows/*` | Cascade order (DeleteUser, DeleteProfile, KickActive, DeleteBinding, BulkDelete). Pure terhadap `*Clients`. | mikrotik/* |
| `domain/*` | Tipe domain (HotspotUser, Scheduler, dst) + enum (ExpiredMode, Charset). Tidak ada IO. | — |
| `scripts/*` | Generator string RouterOS (on-login, on-event, transaction-name, quickprint). Pure, golden-tested. | domain |
| `store/*` | GORM stores (Device, Transaction, ProfileConfig, User). Pure CRUD. | gorm, model |
| `store/model/*` | Schema tabel Postgres. | gorm |
| `internal/config` | Loader env (HTTP_*, DB_*, CORS_*). | — |

### 1.4 Lifecycle startup (`cmd/server/main.go`)

```
 1. logrus + godotenv (.env best-effort)
 2. config.LoadHTTPFromEnv + LoadDBFromEnv
 3. signal.NotifyContext(SIGINT,SIGTERM) → rootCtx
 4. store.Open(DSN) + store.Migrate (auto-migrate 4 tabel)
 5. NewDeviceStore + NewTransactionStore + NewProfileConfigStore
 6. devmgr.New → devMgr.Start(rootCtx)
      └─ loop store.List() → connect tiap device → simpan ClientSet
 7. expiry.New → expSvc.Start(rootCtx)
      └─ loop store.List() → spawn goroutine runChecker per device
 8. (opsional) influx.NewClient + metrics.New + metricsSvc.Start(rootCtx)
 9. Wire devMgr.OnDeviceConnected / OnDeviceRemoved
      → expSvc.StartDevice / StopDevice + metrics StartDevice / StopDevice
10. api.NewServer(deps) → http.Server (WriteTimeout=0 untuk SSE long-lived)
11. ListenAndServe → tunggu signal → Shutdown(grace)
```

### 1.5 Lifecycle per-device

```
POST /devices                  PUT /devices/:id              <signal>
       │                              │                          │
       ▼                              ▼                          ▼
DeviceStore.Create        DevMgr.Remove(old) +              roslib supervisor
       │                  DevMgr.Add(new, ctx.Background)   notify OnStatusChange
       ▼                              │                     ("error" / "closed")
DevMgr.Add(req.ctx) ◄──────────────────                         │
       │                                                         ▼
DevMgr.connect(d):                                       store.UpdateStatus
   roslib.New(m.ctx, Options{                            (mapping connected/
       Address, Username, Password,                       disconnected/error)
       Logger, OnStatusChange })  ← TLS HILANG (lihat 3.2)
    build ClientSet{Hot, Sys, Net, PPP, Log, WF}
    active[deviceID] = cs
    store.UpdateStatus("connected")
    OnDeviceConnected(d)  ─────────► expSvc.StartDevice
                                     metricsSvc.StartDevice
```

Catatan: `m.ctx` adalah root server context — koneksi roslib hidup sepanjang server,
bukan request. Itu memang sengaja (lihat doc `Add`).

### 1.6 Alur data SSE

```
GET /api/v1/devices/r1/stream/hotspot/active
       │
       ▼
handler.Stream.HotspotActive
       │
       ▼
deviceTopic(c, "hotspot-active") → "r1:hotspot-active"
       │
       ▼
Hub.GetOrCreate(topic, startFn, stopFn)  ──► Broker (refcount)
       │                                          │
       │ Subscribe(clientID)                      │  startFn
       │ ───► first subscriber                   ▼
       │                                  Hot.ActiveStream(topic,
       │                                       sen → broker.Publish(...))
       │                                          │
       ▼                                          │
sse.Stream(c, broker):                            │
   set headers text/event-stream                  │
   for { select {                                 │
       <-Request.Context().Done(): return         │  RouterOS
       ev,ok := <-ch: writeEvent(w, ev)  ◄──── publish ke semua subs
       <-keepalive.C: ": keepalive\n\n"           │
   }}                                             │
       │ defer Unsubscribe                        │
       ▼                                          │
last subscriber? → onStop = StopActiveStream(topic)
```

Buffer subscriber 32 event; kalau full, event di-drop untuk subscriber tsb (lihat
`api/sse/broker.go:88-94`). Tidak ada metric.

### 1.7 Model data

| Tabel | Field utama | Catatan |
|---|---|---|
| `mikrotik_devices` | display_name, address, username, password, use_tls, status, last_seen, last_error, expiry_check_interval (default "2m"), active. | Password plaintext. |
| `hotspot_profile_configs` | device_id+profile_name (unique pair), expiry_mode (0/rem/ntf/remc/ntfc), validity, price, sell_price, lock_mac. | Default fallback `"rem"` di store (`profile_config_store.go:31-37`) — tidak crash kalau row tidak ada. |
| `transactions` | device_id, sale_date/time/month, username, price, sell_price, IP, MAC, validity, profile, comment. | Menggantikan `/system/script` di RouterOS. |
| `users` | username, email, password, role, active. | **Stub — tidak dipakai handler manapun**. |

---

## Bagian 2 — Perubahan arsitektural vs mikhmonv3 PHP

Ringkasan perbedaan paling besar (untuk peta detail per-command lihat
`mikhmonv3-analisis.md` + `rosmon.md`):

| Aspek | mikhmonv3 (PHP) | rosmon (Go) |
|---|---|---|
| Transaksi voucher | `/system/script/add` di router, parse kembali via name+owner+source | Tabel `transactions` di Postgres (`service/expiry/service.go:192-209`). Tidak ada migrasi data lama. |
| Expiry user | Scheduler RouterOS per profile (on-event panggil script transaksi) | Per-device goroutine checker (`expiry.runChecker`, interval default 2m). Field comment user tetap di-parse mikhmon format. |
| Mode rem/ntf/remc/ntfc | Embed di on-login script per profile | Disimpan di tabel `hotspot_profile_configs` (`store/profile_config_store.go`). |
| Harga & validity | Di metadata `:put` on-login script | Tabel `hotspot_profile_configs`. |
| Realtime traffic/log | AJAX polling 3s, koneksi konek-putus tiap kali | SSE persisten + roslib native streaming (`interval=` / `follow`) + broker fan-out. |
| Metrics historis | Tidak ada | InfluxDB3 + `metrics/service.go` (system_resource, interface_stats, hotspot_user_bytes/packets, hotspot_active, ppp_active, queue_stats). |
| Multi-router | Tidak ada (1 instance = 1 router via session) | `devmgr.Manager` + `/devices/:device_id/*` di URL (device_id = uint). |
| On-login & transaction script | String inline di PHP | Pure-function builder di `scripts/onlogin`, `scripts/onevent`, `scripts/transaction`, `scripts/quickprint` (golden-tested). |
| Operator auth | `index.php` session-based | **Tidak ada** (lihat 3.2). |

Yang **TIDAK** di-port (atau hilang) — detail di 3.5.

---

## Bagian 3 — Gap & Improvement Review

Severity: 🔴 critical · 🟠 high · 🟡 medium · 🟢 low

### 3.1 Correctness & lifecycle

#### 🔴 Middleware tidak di-attach ke gin engine
File `api/middleware/recovery.go`, `logger.go`, `request_id.go`, `cors.go` lengkap,
tapi tidak ada `r.Use(middleware.Xxx(...))` di `api/server.go` maupun
`api/routes.go`. Diverifikasi via grep — zero usage di production code.

Dampak: panic langsung leak ke gin default (plain text 500, tidak konsisten
dengan envelope), `request_id` selalu kosong di log/SSE clientID
(`sse/writer.go:32-35` fallback ke IP+nanos), CORS pasrah ke gin default (akan
ditolak browser pada production), tidak ada per-request log.

Fix: tambah `r.Use(middleware.Recovery(deps.Logger), middleware.RequestID(),
middleware.Logger(deps.Logger), middleware.CORS(deps.HTTPConfig.CORSOrigins))`
sebelum `r.Group("/api/v1")`. Effort: 4 baris.

#### 🔴 `UseTLS` device tidak diteruskan ke roslib
`store/model/MikrotikDevice.UseTLS bool` ada, tapi di `service/devmgr/manager.go:120-128`
field ini tidak dibaca dan tidak diterjemahkan ke `roslib.Options.TLS *tls.Config`
(roslib pakai `*tls.Config`, bukan bool — lihat `device/options.go:39`).

Dampak: device yang configured `use_tls=true` tetap dial plaintext ke port
non-TLS. Bug diam (router akan tolak handshake atau accept di port plaintext).

Fix: di `connect()`, kalau `d.UseTLS` set `opts.TLS = &tls.Config{ServerName:
host(d.Address)}` (atau pakai `InsecureSkipVerify` kalau cert self-signed,
dengan env opt-in).

#### 🟠 `devmgr.OnStatusChange` pakai context yang bisa sudah-canceled
`makeStatusHook` (`manager.go:160-176`) panggil `m.store.UpdateStatus(m.ctx, ...)`.
`m.ctx` = root ctx server. Saat SIGTERM → `m.ctx` canceled → status update final
("closed") gagal silently karena pakai context canceled.

Fix: pakai `context.Background()` untuk write status terminal, atau dedicated
shutdown ctx dengan timeout pendek.

#### 🟠 `expiry.runChecker` spam log saat device disconnect
Setiap tick (default 2 menit) panggil `s.devMgr.Get(d.ID)`. Saat device
disconnect, return error → loop log "expiry: check failed" terus-menerus.
Tidak ada backoff / state machine.

Fix: cek status device di tick pertama; kalau disconnected, sleep
exponential-backoff (sampai max ~10m) sebelum retry, dan log sekali per
transisi state.

#### 🟠 `Devices.Update` re-connect tidak tunggu old connection benar-benar closed
`api/handler/devices.go:104-105`:
```
h.DevMgr.Remove(existing.ID)
_ = h.DevMgr.Add(context.Background(), existing)
```
`Remove` hanya `cs.Dev.Close()` (`manager.go:115`) yang async — roslib supervisor
goroutine masih running saat `Add` dipanggil. Potensial race kalau supervisor
masih emit OnStatusChange ke DB.

Fix: tambah `Close()` synchronous di roslib (atau channel signal di devmgr) +
short wait sebelum re-dial. Atau redesain `UpdateDevice` ke ops `Reconfigure`
yang atomic.

#### 🟠 `Broker.Publish` silent drop tanpa metric
`api/sse/broker.go:88-94` drop event kalau channel subscriber penuh. Tidak ada
counter / log. Slow client tidak ke-detect.

Fix: tambah `atomic.Uint64` `dropped` per broker + expose di `/healthz` atau
log periodic (1x/menit kalau >0).

#### 🟡 `metrics.startLocked` partial-failure tidak terdeteksi
7 stream di-register sekaligus, kalau salah satu `WriteWarn`, sisanya tetap
running. Cleanup `<-ctx.Done()` panggil `Stop*` ke semua tanpa cek registered.
Tidak fatal tapi log noise di shutdown.

Fix: track registered IDs di slice, hanya panggil `Stop*` untuk yang berhasil.

#### 🟡 `gormDeviceStore.List` filter `active=true` di handler list
`store/device_store.go:25-29` filter `active = true`. `Devices.List` handler
panggil method yang sama → admin tidak bisa lihat inactive device via API.
Bug atau by-design? Inkonsisten dengan tujuan `Active` (toggle, bukan
soft-delete — `gorm.DeletedAt` sudah ada).

Fix: dua method (`List(ctx)` + `ListAll(ctx)`) atau parameter `includeInactive`.

#### 🟡 Reconnect via `Devices.Update` pakai `context.Background()`
`api/handler/devices.go:105` sengaja (komentar tidak ada tapi pattern jelas).
Tapi error di-ignore (`_ = h.DevMgr.Add(...)`) — kalau koneksi baru gagal,
response 200 OK ke client padahal device sebenarnya tidak konek.

Fix: surface error sebagai warning di response (sudah dilakukan di `Create`,
lihat `devices.go:71-77` — pattern bisa diulang).

#### 🟡 `Stream.Publish` lock contention
Broker `mu` di-lock saat publish ke N subscriber (`broker.go:84-95`). Kalau
event burst (mis. `interface_stats` interval 1s × 50 iface = 50 publish/s)
dan ada banyak subscriber, lock ini bisa jadi kontensi.

Fix: copy subs slice di-lock, lalu publish unlocked; atau pakai `sync/atomic`
+ snapshot-pattern.

#### 🟢 `GORM UpdateStatus` dengan `*time.Time` nil
`store/device_store.go:55-62` pakai `Updates(map[string]any{"last_seen":
lastSeen})`. Kalau `lastSeen=nil`, gorm set NULL (OK). Tapi caller di
`makeStatusHook` selalu kirim `&now` jadi tidak ada path nil → field
`*time.Time` di model overkill (bisa di-`time.Time` dengan zero handling).

### 3.2 Security & production readiness

#### 🔴 Tidak ada auth
Semua endpoint `/api/v1/*` terbuka. `store/model/User` ada (username, email,
password, role) tapi tidak diakses handler manapun. README/docs/API.md tidak
menyebut auth.

Dampak: kalau service di-expose internet, siapapun bisa reboot router, hapus
user, kick session.

Fix: minimum BasicAuth + session cookie (operator only). Better: JWT + RBAC
(operator vs admin). Wajib sebelum production.

#### 🔴 Password device plaintext di DB
`store/model/MikrotikDevice.Password string gorm:"not null"`. Tidak ada
enkripsi. DB dump = leak semua credential router.

Fix: AES-GCM dengan key di env (`DEVICE_PASSWORD_KEY`), atau integrasi
secret store (Vault, AWS KMS). Minimal kasih flag `encrypted` + migrasi.

#### 🟠 SQL injection di `history.execQuery` interval
`api/handler/history.go:44-54` (dan beberapa method lain):
```
sql := fmt.Sprintf(`SELECT DATE_BIN(INTERVAL '%s', time) …`, p.interval)
```
`p.interval` = `c.DefaultQuery("interval", "1m")` — string user. InfluxDB3 SQL
SELECT engine mendukung statement chaining? Belum tentu, tapi prinsip never
trust user input.

Fix: parse `interval` lewat `time.ParseDuration` lalu re-format ke string
canonical (mis. `"1m"`, `"15s"`) sebelum interpolasi. Reject kalau gagal.

#### 🟠 CORS default `*` aktif di production
`.env.example` line 26: `CORS_ALLOWED_ORIGINS=*`. User yang copy-paste tidak
sadar bisa expose API ke origin manapun. Plus middleware tidak di-attach
sekarang (lihat 3.1) — jadi sekarang CORS sama sekali tidak aktif. Setelah
fix middleware attach, default `*` jadi backdoor.

Fix: hapus default `*` di `.env.example`, paksa empty → tolak request
cross-origin kecuali explicit set.

#### 🟠 Tidak ada rate limit
POST `/hotspot/users/bulk-delete`, POST `/system/reboot` dst tidak punya
guard. Bisa di-flood untuk DoS router.

Fix: gin-contrib/ratelimit atau token-bucket sederhana per IP + per device.

#### 🟡 SSE bisa exhaust file descriptor
Tiap SSE client = 1 long-lived connection. Tidak ada cap subscriber per topic
atau per IP. Plus `http.Server.WriteTimeout=0` (memang harus untuk SSE).

Fix: limit subscribers per broker (mis. 100) + reject 503 kalau melebihi.

#### 🟡 RouterOS API password log
Pastikan `roslib.Options.Logger` (logrus) tidak log password di reconnect
attempt. Cek di roslib `device/connect.go` — DialContext langsung pakai
password parameter, tidak ada `WithField`. ✅ aman.

#### 🟢 `crypto/rand` untuk request ID ✅
`api/middleware/request_id.go:28-32` pakai `crypto/rand` 8 byte → 16 hex. Bagus.

### 3.3 Observability

#### 🟠 `/healthz` tidak cek dependency
`api/server.go:32-34` cuma return static OK. Tidak cek DB ping, devmgr
connected count, influx ping.

Fix: extend ke `{ status, db, devices: {connected, total}, influx }` dengan
status non-200 kalau critical dep down.

#### 🟡 `request_id` tidak di-propagate ke roslib call
Middleware `RequestID` (kalau attached) set ke `gin.Context`. Tapi tidak
di-inject ke `c.Request.Context()`. Saat handler panggil `h.Hot.UserList(ctx)`,
roslib log internal tidak punya correlation ID.

Fix: `c.Set("request_id", id)` + `c.Request = c.Request.WithContext(
context.WithValue(c.Request.Context(), ctxKey, id))`. roslib bisa ambil dari
ctx kalau di-aware (perlu API tambahan di roslib).

#### 🟡 Metrics drop counter
Lihat 3.1 (broker silent drop). Tidak ada visibility.

#### 🟢 Logrus JSON formatter konsisten ✅
Bagus, tapi `expiry.log` dan `metrics.log` pakai `WithField("device", displayName)`
tidak konsisten (kadang per-checker, kadang per-stream). Standarkan.

### 3.4 Test coverage

#### 🟠 Service layer tanpa unit test
`service/devmgr/manager.go`, `service/expiry/service.go`, `service/metrics/service.go`
— tidak ada `_test.go`. Padahal di sini logic goroutine paling rentan race.

Fix: tambah test pakai `roslib.Device` mock (perlu API mock di roslib) +
`store` interface mock. Test minimal:
- `devmgr`: Add/Remove idempotent, OnDeviceConnected dipanggil setelah
  active map terisi, status hook di-block saat ctx canceled.
- `expiry`: StartDevice idempotent, parse comment edge cases, mode 0 no-op.
- `metrics`: StartDevice idempotent, StopDevice clean up semua streams.

#### 🟠 HTTP handler tanpa test
`api/handler/*_test.go` tidak ada. Yang ada cuma `scripts/onlogin/builder_test.go`,
`scripts/onevent/builder_test.go`, `scripts/transaction/name_test.go`,
`scripts/quickprint/source_test.go`.

Fix: test envelope mapping (`MapError`), validation error format, route
existence smoke test.

#### 🟡 Workflows hanya integration test
`workflows/*` cuma di-test live ke router (build tag `integration`). Cascade
logic complex tapi tidak ada unit test pakai mock device.

Fix: bikin `roslib.MockDevice` (atau wrapper interface kecil yang
`workflows.Clients` dependent) untuk regression test cascade.

#### 🟢 DTO mapping tidak di-test
`dto.From*` deterministic tapi cukup banyak — mudah di-table-test.

### 3.5 Feature parity vs mikhmonv3

| Fitur mikhmonv3 | Status | Catatan |
|---|---|---|
| Hotspot user CRUD | ✅ | Termasuk reset-counters, reset-usage, set-mac, bulk-delete |
| Hotspot profile CRUD | ✅ | Dengan cached list |
| Hotspot active list + kick | ✅ | Workflow `KickActive` |
| Hotspot cookie/host/binding | ✅ | Workflow `DeleteBinding` cascade 9 step |
| Voucher batch generate | ❌ | `domain.VoucherSpec` ada, tidak ada handler/workflow yang gunakan |
| Quickprint | ⚠ | Generator ada, tidak ada API handler — diasumsikan frontend handle |
| System info & control | ✅ | identity, resource, routerboard, clock, reboot, shutdown |
| System scheduler/script CRUD | ✅ | |
| Logging hotspot-disk auto-enable | ✅ | `POST /system/logging/hotspot-disk` |
| Realtime log | ✅ | SSE `/stream/log?topics=...` |
| Realtime traffic | ✅ | SSE `/stream/network/interfaces/:name/traffic` |
| Realtime resource | ✅ | SSE `/stream/system/resource` |
| PPP secret CRUD | ✅ | Field hilang di mikhmonv3 PHP (lihat `mikhmonv3-analisis.md` warning) — di Go sudah lengkap |
| PPP profile CRUD | ⚠ | Handler ada (`ppp_profile.go`); cek di handler list |
| PPP active list + kick | ✅ | |
| Report selling (per hari/bulan) | ⚠ | `txStore.ListByDevice` + `ListByDeviceDate` ada, tidak terlihat handler khusus |
| Report export (CSV/PDF) | ❌ | Tidak ada |
| Migrasi data dari `/system/script` lama | ❌ | Tidak ada tool import |
| Operator multi-user | ❌ | `model.User` stub, tidak ada login handler |
| InfluxDB history | ✅+ | Bonus, tidak ada di PHP |
| Multi-router | ✅+ | Bonus, tidak ada di PHP |

---

## Bagian 4 — Top action items (prioritas)

| # | Item | Severity | Effort | Dampak | Dependency |
|---|---|---|---|---|---|
| 1 | Attach middleware (Recovery, RequestID, Logger, CORS) ke gin engine | 🔴 | XS (4 baris) | Tinggi — fix observability + envelope konsisten + CORS aktif | — |
| 2 | Fix `UseTLS` propagation di `devmgr.connect` | 🔴 | XS (5–10 baris) | Tinggi — fungsi yang declared broken | — |
| 3 | Auth middleware + password device encryption | 🔴 | M (2–3 hari) | Tinggi — wajib sebelum production | `User` model + key management |
| 4 | Validasi `interval` di `History.execQuery` | 🟠 | XS (1 fungsi) | Med — SQL injection guard | — |
| 5 | Backoff + state machine di `expiry.runChecker` saat device disconnect | 🟠 | S (refactor 1 file) | Med — kurangi log noise + reduce router load | — |
| 6 | Unit test service layer (devmgr/expiry/metrics) | 🟠 | M (1 minggu) | Med — proteksi race regression | Perlu mock device di roslib |
| 7 | `/healthz` dengan dependency check | 🟡 | S (½ hari) | Med — visibility production | — |
| 8 | Broker drop counter + metric expose | 🟡 | S (½ hari) | Low — debug slow client | — |
| 9 | `DeviceStore.List` tidak filter `active` untuk handler API | 🟡 | XS | Low — UX admin | — |
| 10 | Voucher batch generate workflow + handler | 🟢 | M | Med — fitur parity | — |
| 11 | Report selling handler + CSV export | 🟢 | M | Med — fitur parity | — |
| 12 | Migrasi import dari `/system/script` lama (one-shot CLI) | 🟢 | M | Low — kebutuhan migrasi | — |

### Rekomendasi sprint pertama

1. **Hari 1**: item #1 + #2 + #4. Three quick wins, zero risk.
2. **Hari 2-3**: item #3 (auth + password encryption). Wajib untuk production.
3. **Hari 4-5**: item #5 + #7 + #8 (resilience + observability).
4. **Sprint berikut**: item #6 (test infra), lalu fitur parity (#10-#12).

---

## Bagian 5 — Lampiran

### 5.1 Peta file kunci

| Path | LOC | Tanggung jawab |
|---|---|---|
| `cmd/server/main.go` | 170 | Entry point, wiring |
| `api/server.go` | 41 | Gin engine bootstrap (⚠ middleware tidak di-attach) |
| `api/routes.go` | 52 | Mount handler |
| `api/middleware/recovery.go` | 39 | Panic → envelope 500 (dead code) |
| `api/middleware/request_id.go` | 33 | X-Request-ID (dead code) |
| `api/middleware/logger.go` | 38 | Per-request log (dead code) |
| `api/middleware/cors.go` | 28 | CORS config (dead code) |
| `api/middleware/device.go` | 27 | Device → ClientSet (DIPAKAI via routes.go) |
| `api/sse/broker.go` | 104 | Fan-out 1:N + refcount |
| `api/sse/hub.go` | 38 | Registry topic→Broker |
| `api/sse/writer.go` | 89 | SSE protocol + keepalive |
| `api/handler/stream.go` | 281 | SSE endpoints + sentence→DTO |
| `api/handler/hotspot_user.go` | 206 | User CRUD + bulk delete |
| `api/handler/history.go` | 225 | InfluxDB query (⚠ SQL injection di interval) |
| `service/devmgr/manager.go` | 177 | Koneksi router + status hook |
| `service/expiry/service.go` | 213 | Per-device expiry checker |
| `service/expiry/parser.go` | 27 | Parse comment expiry mikhmon format |
| `service/metrics/service.go` | 283 | 7 streams → InfluxDB3 |
| `workflows/delete_user.go` | 75 | Cascade DeleteUser §4.1 |
| `workflows/delete_binding.go` | 119 | Cascade DeleteBinding §4.2 (9 step) |
| `mikrotik/hotspot/user.go` | 290 | UserList/Add/Set/Remove dst |
| `mikrotik/hotspot/profile.go` | 184 | ProfileList/Add/Set/Remove dst |
| `scripts/onlogin/builder.go` | 114 | On-login script builder |

### 5.2 Glosarium

| Term | Definisi |
|---|---|
| **ClientSet** | `service/devmgr.ClientSet`. Bundle sub-client (hotspot/system/network/ppp/syslog) + workflows.Clients per device. |
| **Broker** | `api/sse.Broker`. Fan-out 1 backend stream → N SSE subscriber, dengan refcount onStart/onStop. |
| **Hub** | `api/sse.Hub`. Registry topic-string → Broker. Auto-create. |
| **Sentence** | `roslib.Sentence` (alias dari `decode.Sentence`). Satu reply RouterOS API ("!re", "!done", "!trap"). |
| **PollEngine** | Mekanisme di roslib untuk register polling periodik dengan interval-grouping (batch beberapa poll yang interval-nya sama). |
| **OnStatusChange** | Callback di `roslib.Options` untuk notify perubahan status koneksi ("connected", "error", "closed"). Dipakai devmgr untuk update DB. |
| **ExpiredMode** | Enum `domain.ExpiredMode`: `0` (none), `rem` (remove), `ntf` (notice/limit=1s), `remc` (rem+record), `ntfc` (ntf+record). |
| **mikhmon expiry format** | `"jan/02/2006 15:04:05"` di field comment user — 19 char pertama di-parse. |
| **Bulk separator** | `~` untuk multi-ID di URL mikhmonv3 (preserved di workflows.ParseBulkIDs). |
| **deviceTopic** | Helper di `api/handler/stream.go` yang scope topic per-device (`<deviceID>:<base>`) supaya Hub global tidak mix stream antar router. |
| **WriteTimeout=0** | Setting di `http.Server` (sengaja) untuk allow SSE long-lived; trade-off → slow-loris vulnerable. |
| **Replace directive** | `go.mod` line 5: `replace github.com/quiqxiq/roslib => ../`. Library dikembangkan side-by-side, bukan via tag. |

---

## Kesimpulan

Arsitektur sehat dan idiomatic Go: layer terpisah jelas (HTTP → service → mikrotik
clients → roslib), workflows pure terhadap `*Clients`, generator script di-pisah
ke pure-function package. Decoupling DB → router credentials sudah benar.

Tiga **showstopper** sebelum production:
1. **Middleware tidak di-attach** (3.1 #1) — fix 4 baris.
2. **`UseTLS` tidak di-propagate** (3.1 #2) — silent bug.
3. **Auth + password encryption** (3.2 #1/#2) — wajib sebelum expose service.

Empat **high-priority** untuk stabilitas:
- Backoff di expiry checker saat device down.
- SQL injection guard di history endpoint.
- `/healthz` dengan dependency check.
- Unit test service layer.

Sisanya feature parity (voucher batch, report export) bisa di-prioritaskan sesuai
kebutuhan operasional. Migrasi data dari mikhmonv3 lama belum ada path — perlu
diskusi apakah memang ada user existing yang mau migrasi.
