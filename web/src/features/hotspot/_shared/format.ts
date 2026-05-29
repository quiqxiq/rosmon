// Shared RouterOS value formatters used across all hotspot pages. Each
// helper handles the same set of "RouterOS returned undefined / empty
// string" edge cases so call sites stay terse.

// `parseRouterOSNumber` safely turns a RouterOS string field into a
// number. RouterOS reports counters like `bytes-in` as decimal strings
// (sometimes with `K`/`M` suffixes when the user enabled human-readable
// display on the device, but the API normalizes to raw decimals). We
// treat empty/undefined/NaN as `0` — counters that "don't exist" simply
// haven't ticked yet.
export function parseRouterOSNumber(s?: string | null): number {
  if (s == null || s === '') return 0
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

// `formatBytes` renders a byte count as a short SI-ish string. Mirrors
// the existing `formatBytes` from `features/hotspot/.../data/data.ts`
// (kept identical so column output looks the same after migration).
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(units.length - 1, Math.floor(Math.log10(n) / 3))
  const value = n / 10 ** (i * 3)
  // Two decimals up to MB, one after — keeps columns aligned.
  const precision = i <= 2 ? 2 : 1
  return `${value.toFixed(precision)} ${units[i]}`
}

// `formatUptime` passes through RouterOS duration strings ("1d2h3m") as
// they're already human-readable. Empty/undefined renders an em-dash to
// keep the column visually quiet for never-connected users.
export function formatUptime(s?: string | null): string {
  if (!s) return '—'
  return s
}

// `routerOSBool` parses RouterOS's quoted booleans ('"true"' / '"false"').
// Anything else (undefined, empty, unknown variant) → false, matching the
// device default for almost every boolean RouterOS exposes.
export function routerOSBool(v?: string | null): boolean {
  return v === 'true'
}
