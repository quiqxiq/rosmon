// Deterministic mock data generator for the planned voucher sales listing
// endpoint. This file lets Phase 6 ship the UI against the eventual API
// shape before the backend route exists. When the real endpoint lands,
// `service.listSales()` swaps its implementation and this file can be
// deleted.
//
// Determinism rationale: a stable seed derived from (routerId, from, to)
// means every refresh shows the same rows for the same range — crucial
// for testing UI states (pagination, filters, detail dialog) without the
// page reshuffling between renders.

import type { SalesListParams, VoucherSale } from './schema'

// Fixed pools — same shape as real RouterOS data so the UI never has to
// branch on "is this a mock?".
const PROFILE_POOL = [
  'voucher-1d',
  'voucher-3d',
  'voucher-7d',
  'voucher-30d',
  'unlimited',
] as const

const SERVER_POOL = ['hotspot1', 'hotspot2'] as const

const PRICE_POOL = [5000, 10000, 15000, 25000, 50000] as const

const VALIDITY_POOL = ['1h', '3h', '1d', '3d', '7d', '30d'] as const

// ─────────────────── Seeded RNG (xmur3 + mulberry32) ───────────────────
// Hash a string to a 32-bit integer. xmur3 is small, well-distributed,
// and avoids the pathological collisions of Java's `String.hashCode`.
function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    h ^= h >>> 16
    return h >>> 0
  }
}

// mulberry32: fast, decent-quality 32-bit PRNG. Returns floats in [0, 1).
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeRng(seedStr: string): () => number {
  const h = xmur3(seedStr)
  return mulberry32(h())
}

function pickFrom<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

// Generate a plausible MAC. Lowercase, colon-delimited, locally-administered
// bit set so it can't accidentally collide with a real OUI in test logs.
function randMac(rng: () => number): string {
  const oct = (): string =>
    Math.floor(rng() * 256)
      .toString(16)
      .padStart(2, '0')
  // First byte: set locally-administered bit (0x02), clear multicast bit.
  const first = (Math.floor(rng() * 64) * 4 + 2).toString(16).padStart(2, '0')
  return [first, oct(), oct(), oct(), oct(), oct()].join(':').toUpperCase()
}

// Generate a plausible private IPv4 in the 10.x.x.x range — that's where
// most hotspot DHCP pools live.
function randIp(rng: () => number): string {
  return `10.${randInt(rng, 0, 255)}.${randInt(rng, 0, 255)}.${randInt(rng, 1, 254)}`
}

// Six-character alphanumeric token for voucher codes. Matches the
// `vc-{6}` / `up-{6}` pattern used in the on-login script comments.
function randCode(rng: () => number, len = 6): string {
  const charset = 'abcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += charset[Math.floor(rng() * charset.length)]
  }
  return out
}

// Parse YYYY-MM-DD into a local-midnight Date. Using local time avoids
// off-by-one days when the dev box is east of UTC.
function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10))
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime()
  return Math.max(0, Math.floor(ms / 86_400_000)) + 1 // inclusive
}

// ─────────────────── Main generator ───────────────────

// Build the full dataset for a (router, range) tuple. The mock applies
// `search`/`profile`/`server` filters BEFORE pagination so the `total`
// count reflects the filtered set — same semantics the real backend
// will return.
export function generateMockSales(params: SalesListParams): {
  filtered: VoucherSale[]
  totalRevenue: number
} {
  const from = parseYmd(params.from)
  const to = parseYmd(params.to)
  if (to < from) return { filtered: [], totalRevenue: 0 }

  const seed = `${params.from}|${params.to}`
  const rng = makeRng(seed)
  const dayCount = daysBetween(from, to)

  // Volume: 3-15 sales per day, capped at 500 total for the range so
  // wide ranges still feel responsive in dev.
  const totalTarget = Math.min(500, dayCount * randInt(rng, 3, 15))

  const items: VoucherSale[] = []
  let nextId = 1000

  for (let i = 0; i < totalTarget; i++) {
    // Distribute sale timestamps roughly uniformly across the range.
    const dayOffset = Math.floor(rng() * dayCount)
    const hour = randInt(rng, 6, 23) // hotspot purchases skew toward daytime
    const minute = randInt(rng, 0, 59)
    const second = randInt(rng, 0, 59)
    const soldAt = new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate() + dayOffset,
      hour,
      minute,
      second,
    )

    const type = rng() < 0.7 ? 'vc' : 'up'
    const code = randCode(rng)
    const username = type === 'vc' ? code : `${code}-u`
    const profile = pickFrom(rng, PROFILE_POOL)
    const price = pickFrom(rng, PRICE_POOL)
    const server = pickFrom(rng, SERVER_POOL)
    const validity = pickFrom(rng, VALIDITY_POOL)

    items.push({
      id: nextId++,
      // routerId is intentionally a context concern — keep null in the
      // mock to match the schema's `.nullable()`. The real backend fills
      // this in.
      router_id: null,
      sold_at: soldAt.toISOString(),
      username,
      profile_name: profile,
      price,
      selling_price: price,
      server,
      ip_address: randIp(rng),
      mac_address: randMac(rng),
      validity,
      // idempotency_key is opaque on the real backend; here we just
      // make it look like a hash so the detail dialog has something
      // shaped like the real thing.
      idempotency_key: `mock-${seed}-${i.toString(16).padStart(6, '0')}`,
      created_at: soldAt.toISOString(),
    })
  }

  // Sort descending by sold_at — newest first. Matches what users expect
  // when scanning a sales log.
  items.sort((a, b) => b.sold_at.localeCompare(a.sold_at))

  // Apply filters server-side (i.e. before pagination) so the total
  // reflects the filtered count.
  const search = (params.search ?? '').trim().toLowerCase()
  const profileFilter = params.profile ?? ''
  const serverFilter = params.server ?? ''

  const filtered = items.filter((s) => {
    if (profileFilter && s.profile_name !== profileFilter) return false
    if (serverFilter && s.server !== serverFilter) return false
    if (search) {
      const hay =
        `${s.username} ${s.profile_name} ${s.mac_address} ${s.ip_address}`.toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  })

  const totalRevenue = filtered.reduce((sum, s) => sum + s.selling_price, 0)
  return { filtered, totalRevenue }
}
