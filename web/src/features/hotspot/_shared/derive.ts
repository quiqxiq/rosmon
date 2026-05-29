// Helpers that DERIVE state from raw RouterOS strings that the API
// doesn't enrich for us. Kept in `_shared/` because both the Users page
// (expiry column) and Profiles page (monitor signature detection) need
// them, and both live under `features/hotspot/`.

const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

// `parseExpiryFromComment` reads the two voucher comment formats
// documented in AGENTS.md:
//   "mmm/dd/yyyy hh:mm:ss N"
//   "mmm/dd/yyyy hh:mm:ss X"
// The trailing `N` (notify) / `X` (delete) flag is preserved verbatim
// elsewhere — here we only need the timestamp. Returns `null` if the
// comment doesn't match the expected shape so the caller can render
// nothing rather than "Invalid Date".
const EXPIRY_RE = /^([a-z]{3})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})\s+[NX]/i

export function parseExpiryFromComment(comment?: string | null): Date | null {
  if (!comment) return null
  const m = EXPIRY_RE.exec(comment.trim())
  if (!m) return null
  const month = MONTH_INDEX[m[1].toLowerCase()]
  if (month === undefined) return null
  const day = Number(m[2])
  const year = Number(m[3])
  const hour = Number(m[4])
  const minute = Number(m[5])
  const second = Number(m[6])
  const d = new Date(year, month, day, hour, minute, second)
  return Number.isNaN(d.getTime()) ? null : d
}

// `hasExpiredMonitor` checks a profile's `on_login` script for the
// multi-tenant signature we install via the "Setup Expired Monitor"
// flow. The signature is the `:put (",{expmode},{price},...")` line —
// matching just the `:put (",` prefix is enough; no other onlogin
// pattern in the wild starts that way.
export function hasExpiredMonitor(onLogin?: string | null): boolean {
  if (!onLogin) return false
  return onLogin.includes(':put (",')
}
