/* Format helpers — port dari prototype/ui.jsx `fmt` object. */

export function fmtBytes(n: number | null | undefined): string {
  if (n == null) return '—'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v < 10 && i > 0 ? 2 : i > 0 ? 1 : 0)} ${u[i]}`
}

export function fmtRate(bps: number | null | undefined): string {
  if (bps == null) return '—'
  const u = ['bps', 'Kbps', 'Mbps', 'Gbps']
  let i = 0
  let n = bps
  while (n >= 1000 && i < u.length - 1) {
    n /= 1000
    i++
  }
  return `${n.toFixed(n < 10 ? 1 : 0)} ${u[i]}`
}

export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null) return '—'
  const s = Math.floor(sec)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = s % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${ss}s`
  return `${ss}s`
}

export function fmtRp(n: number | null | undefined): string {
  if (n == null) return '—'
  return 'Rp ' + n.toLocaleString('id-ID')
}

export function fmtRpShort(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e9) return `Rp ${(n / 1e9).toFixed(1)}M`
  if (n >= 1e6) return `Rp ${(n / 1e6).toFixed(1)}jt`
  if (n >= 1e3) return `Rp ${(n / 1e3).toFixed(0)}rb`
  return `Rp ${n}`
}

export function fmtAgo(secAgo: number): string {
  if (secAgo < 5) return 'baru saja'
  if (secAgo < 60) return `${Math.floor(secAgo)}d`
  if (secAgo < 3600) return `${Math.floor(secAgo / 60)} mnt`
  if (secAgo < 86400) return `${Math.floor(secAgo / 3600)} jam`
  return `${Math.floor(secAgo / 86400)} hari`
}

export function fmtPct(n: number): string {
  return `${Math.round(n)}%`
}

export function fmtAgoFromMs(ms: number): string {
  return fmtAgo((Date.now() - ms) / 1000)
}

export const fmt = {
  bytes: fmtBytes,
  rate: fmtRate,
  duration: fmtDuration,
  rp: fmtRp,
  rpShort: fmtRpShort,
  ago: fmtAgo,
  pct: fmtPct,
  agoFromMs: fmtAgoFromMs,
}
