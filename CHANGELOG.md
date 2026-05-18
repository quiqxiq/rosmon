# Changelog

Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versi pakai semantic versioning.

## [Unreleased]

Refactor besar berdasarkan `ANALYSIS.md` — fase 1–4. Auth dan password
device encryption ditunda ke fase 5 (separate plan).

### Security

- **CORS default**: dari `*` (permissive) → kosong (same-origin only).
  Operator harus eksplisit set `CORS_ALLOWED_ORIGINS` untuk allow cross-origin.
- **SQL injection guard** di `parseHistoryParams.interval`: parse via
  `time.ParseDuration` + reformat ke canonical string sebelum interpolasi
  ke SQL `DATE_BIN INTERVAL '...'`.
- **TLS ke router**: `MikrotikDevice.UseTLS=true` sekarang benar-benar
  diteruskan ke `roslib.Options.TLS`. Sebelumnya silently di-ignore →
  device "TLS" dial plaintext. Self-signed cert opt-in via
  `DEVICE_TLS_INSECURE=true`.

### Added

- **Middleware attach**: `Recovery`, `RequestID`, `Logger`, `CORS`
  sekarang aktif di gin engine (sebelumnya didefinisikan tapi tidak
  dipasang). `X-Request-ID` ter-echo di response header + log entry.
- **`/healthz` dependency check**: cek DB ping, count device
  connected vs total, Influx, SSE subscriber + drop count.
  Status 503 kalau DB down atau device aktif tapi 0 connected.
- **Voucher batch generator** (`POST /hotspot/vouchers/generate`):
  workflow `workflows.GenerateVouchers` + handler + DTO. Charset
  exclude karakter ambigu (`i`, `l`, `o`, `0`, `1`, `I`, `O`).
  Validity terisi → expiry stamp di-attach ke comment user (format
  mikhmonv3 lowercase month). Partial failure → 207 Multi-Status
  dengan vouchers yang sudah berhasil.
- **Report selling endpoints**:
  - `GET /reports/selling` — list dengan filter `?month=`.
  - `GET /reports/selling/today` — list per tanggal hari ini.
  - `GET /reports/selling/summary` — agregat count/total/profit/by_profile.
  - `GET /reports/selling.csv` — CSV export download.
  Endpoint tidak butuh device terhubung (data historis dari DB).
- **`store.DeviceStore.ListAll`** — varian tanpa filter `active=true`.
  Handler `Devices.List` sekarang pakai ini → operator bisa lihat
  device inactive untuk re-enable. Bootstrap service tetap pakai
  `List()` (filter aktif).
- **`devmgr.ErrDeviceNotConnected`** — sentinel error yang dapat
  dicek via `errors.Is` untuk diferensiasi disconnect vs internal error.
- **`devmgr.RemoveAndWait`** — varian `Remove` yang menunggu supervisor
  goroutine roslib benar-benar exit. Dipakai `Devices.Update` saat
  re-dial koneksi baru.
- **`roslib.Device.CloseAndWait`** — base API baru di library roslib.
  `Close` tetap async; `CloseAndWait` tambahan `sync.WaitGroup.Wait`
  untuk supervisor goroutines.
- **`sse.Hub.Stats()`** — expose per-topic subscriber + drop count
  untuk healthz / monitoring.

### Changed

- **Expiry checker backoff state machine**: saat device disconnect,
  loop transisi ke backoff (30s → 10m, ×2 per gagal). Log sekali
  per transisi state (sebelumnya spam log "expiry: check failed"
  setiap tick). Recover otomatis saat device connect kembali.
- **`devmgr.persistStatus`**: status update DB pakai
  `context.Background()` + timeout 3s, bukan turunan root ctx. Status
  terminal ("closed", "error") tidak silently di-drop saat shutdown.
- **`Devices.Update`** pakai `RemoveAndWait` + surface reconnect
  error sebagai warning di response (tidak lagi silently swallow).
- **SSE broker `Publish`**: snapshot subscriber channel di-lock, lalu
  publish unlocked. Throughput lebih baik + race-free. Drop counter
  inc saat channel subscriber penuh.
- **SSE `Unsubscribe`**: tidak lagi `close()` channel (race detector
  warning pre-existing pada close-during-publish). Channel di-GC
  oleh runtime saat reference habis.
- **`metrics.startLocked` partial-failure tracking**: hanya panggil
  `Stop*` untuk stream yang berhasil register (cleanup pakai
  `[]startedStream` tracker). Sebelumnya panggil semua Stop blindly →
  log noise saat shutdown.

### Fixed

- **`expiry.ParseExpiry` off-by-one**: layout `"jan/02/2006 15:04:05"`
  20 chars, tapi parser pakai `[:19]` yang strip karakter terakhir.
  Plus token `"jan"` lowercase di Go time.Parse di-treat sebagai
  literal → hanya bulan Januari yang parsable. Fix: layout
  `"Jan/02/2006 15:04:05"` (case-insensitive) + `len(mikhmonLayout)`.
- **`expiry.executeExpiry` date formatting**: `time.Format("jan/02/2006")`
  output `"jan/<dd>/<yyyy>"` untuk semua bulan (literal "jan"). `SaleMonth`
  selalu jadi `"jan<year>"` → filter laporan bulanan broken. Fix:
  `strings.ToLower(now.Format("Jan/02/2006"))`.

### Tests

- `service/expiry/parser_test.go` — table-test ParseExpiry (valid,
  invalid, edge cases including off-by-one regression).
- `service/devmgr/manager_test.go` — Get sentinel error, ListActive
  copy semantics, buildTLSConfig + env opt-in.
- `api/sse/broker_test.go` — refcount start/stop, fan-out, dropped
  count, race detection (`-race`).
- `api/handler/helpers_test.go` — MapError table-test untuk semua
  sentinel + wrapped error.
- `api/handler/history_test.go` — interval validation termasuk SQL
  injection rejection.
- `api/handler/report_test.go` — aggregate helper.
- `api/middleware/middleware_test.go` — RequestID generate/preserve,
  Recovery envelope, CORS allowlist behavior.
- `workflows/generate_vouchers_test.go` — validation, randomString,
  buildVoucherAddArgs.
- `domain/charset_chars_test.go` — character set composition.

### Documentation

- `docs/API.md` — voucher generator, reports, healthz dependency
  format, CORS default change, DEVICE_TLS_INSECURE env.
- `.env.example` — CORS default kosong dengan comment warning.
