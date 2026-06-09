import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import { portalApiClient } from '@/lib/api/portal-client'
import type { PortalPayment } from '../../_shared/types'

export async function listPortalPayments(): Promise<PortalPayment[]> {
  const res = await portalApiClient.get<Envelope<PortalPayment[]>>('/customer/payments')
  return unwrap(res.data)
}
