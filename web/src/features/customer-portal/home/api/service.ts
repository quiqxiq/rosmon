import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import { portalApiClient } from '@/lib/api/portal-client'
import type { PortalMe } from '../../_shared/types'

export async function getPortalMe(): Promise<PortalMe> {
  const res = await portalApiClient.get<Envelope<PortalMe>>('/customer/me')
  return unwrap(res.data)
}
