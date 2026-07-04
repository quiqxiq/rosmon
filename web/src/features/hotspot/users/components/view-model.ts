import type { HotspotUserRecord } from '../api/schema'
import {
  parseRouterOSNumber,
  routerOSBool,
} from '../../_shared/format'
import { parseExpiryFromComment } from '../../_shared/derive'

// `HotspotUserViewModel` is what the table actually consumes. It bakes
// the RouterOS-string fields into typed values (`bytes-in` → number,
// `disabled='true'` → enabled/disabled enum) plus a parsed expiry that
// the new Expiry column renders directly. The raw record stays attached
// so dialogs / row actions can pull the original API key shape when
// mutating.
export type HotspotUserViewModel = {
  id: string                            // RouterOS .id (e.g. "*A1")
  name: string
  password: string
  profile: string
  macAddress: string
  server: string
  uptime: string
  bytesIn: number
  bytesOut: number
  enabledStatus: 'enabled' | 'disabled'
  expiry: { at: Date; isPast: boolean } | null
  comment: string
  raw: HotspotUserRecord
}

// Builds a stable view model from a raw `HotspotUserRecord`. `now` is
// passed in so the consumer can memoize per render (avoiding 60Hz
// re-renders on `Date.now()`) and so unit tests stay deterministic.
export function toUserViewModel(
  raw: HotspotUserRecord,
  now: Date = new Date(),
): HotspotUserViewModel {
  const expAt = parseExpiryFromComment(raw.comment)
  return {
    id: raw.id,
    name: raw.name ?? '',
    password: raw.password ?? '',
    profile: raw.profile ?? '',
    macAddress: raw['mac-address'] ?? '',
    server: raw.server ?? '',
    uptime: raw.uptime ?? '',
    bytesIn: parseRouterOSNumber(raw['bytes-in']),
    bytesOut: parseRouterOSNumber(raw['bytes-out']),
    enabledStatus: routerOSBool(raw.disabled) ? 'disabled' : 'enabled',
    expiry: expAt ? { at: expAt, isPast: expAt.getTime() < now.getTime() } : null,
    comment: raw.comment ?? '',
    raw,
  }
}
