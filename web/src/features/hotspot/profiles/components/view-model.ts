import type { ProfileWithMeta } from '../api/schema'
import type { ExpMode } from '../data/schema'
import { parseRouterOSNumber, routerOSBool } from '../../_shared/format'
import { hasExpiredMonitor } from '../../_shared/derive'

// `HotspotProfileViewModel` is the table's typed read-model. It maps
// the API's `ProfileWithMeta` (snake_case, optional strings) into the
// shape the columns/dialogs expect, with parsed numbers and a derived
// `hasExpiredMonitor` flag.
export type HotspotProfileViewModel = {
  id: string
  name: string
  rateLimit: string
  sharedUsers: string
  addressPool: string
  parentQueue: string
  validity: string
  expMode: ExpMode
  price: number
  sellingPrice: number
  lockUser: boolean
  lockServer: boolean
  noExpiry: boolean
  hasExpiredMonitor: boolean
  raw: ProfileWithMeta
}

export function toProfileViewModel(raw: ProfileWithMeta): HotspotProfileViewModel {
  return {
    id: raw.id,
    name: raw.name,
    rateLimit: raw.rate_limit ?? '',
    sharedUsers: raw.shared_users ?? '',
    addressPool: raw.address_pool ?? '',
    parentQueue: raw.parent_queue ?? '',
    validity: raw.validity ?? '',
    expMode: (raw.exp_mode as ExpMode) || 'none',
    price: parseRouterOSNumber(raw.price),
    sellingPrice: parseRouterOSNumber(raw.selling_price),
    lockUser: routerOSBool(raw.lock_user),
    lockServer: routerOSBool(raw.lock_server),
    noExpiry: raw.no_expiry ?? false,
    hasExpiredMonitor: hasExpiredMonitor(raw.on_login),
    raw,
  }
}
