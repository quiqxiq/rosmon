import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import { portalApiClient } from '@/lib/api/portal-client'
import type { PortalSubscription } from '../../_shared/types'

export async function listPortalSubscriptions(): Promise<PortalSubscription[]> {
  const res = await portalApiClient.get<Envelope<PortalSubscription[]>>('/customer/subscriptions')
  return unwrap(res.data)
}

export async function getPortalSubscriptionStatus(id: number): Promise<PortalSubscription> {
  const res = await portalApiClient.get<Envelope<PortalSubscription>>(
    `/customer/subscriptions/${id}/status`,
  )
  return unwrap(res.data)
}
