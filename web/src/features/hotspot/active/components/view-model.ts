import type { HotspotActiveRecord } from '../api/schema'

// `HotspotActiveViewModel` is the column-friendly shape. RouterOS's
// active record has hyphenated keys (`mac-address`, `session-time-left`)
// — we expose them as camelCase so the columns read naturally. There's
// no traffic data on the active record (counters live on the user
// record), so the byte columns from the old mock schema are gone.
export type HotspotActiveViewModel = {
  id: string
  user: string
  address: string
  macAddress: string
  server: string
  uptime: string
  sessionTimeLeft: string
  loginBy: string
  comment: string
  raw: HotspotActiveRecord
}

export function toActiveViewModel(
  raw: HotspotActiveRecord,
): HotspotActiveViewModel {
  return {
    id: raw['.id'],
    user: raw.user ?? '',
    address: raw.address ?? '',
    macAddress: raw['mac-address'] ?? '',
    server: raw.server ?? '',
    uptime: raw.uptime ?? '',
    sessionTimeLeft: raw['session-time-left'] ?? '',
    loginBy: raw['login-by'] ?? '',
    comment: (raw as { comment?: string }).comment ?? '',
    raw,
  }
}
