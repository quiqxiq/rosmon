import type { HotspotHostRecord } from '../api/schema'
import { routerOSBool } from '../../_shared/format'

// `HotspotHostViewModel` is the column-friendly shape. RouterOS exposes
// `authorized` as `'true' | 'false'`; we surface it as a real boolean.
// The legacy `bypassed` column doesn't exist on the API — that lives on
// `IPBindingRecord` and is shown separately. The view-model omits it.
export type HotspotHostViewModel = {
  id: string
  macAddress: string
  address: string
  toAddress: string
  server: string
  authorized: boolean
  comment: string
  raw: HotspotHostRecord
}

export function toHostViewModel(raw: HotspotHostRecord): HotspotHostViewModel {
  return {
    id: raw['.id'],
    macAddress: raw['mac-address'] ?? '',
    address: raw.address ?? '',
    toAddress: raw['to-address'] ?? '',
    server: raw.server ?? '',
    authorized: routerOSBool(raw.authorized),
    comment: (raw as { comment?: string }).comment ?? '',
    raw,
  }
}
