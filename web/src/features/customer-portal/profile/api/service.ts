import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import { portalApiClient } from '@/lib/api/portal-client'
import type { ChangePasswordRequest, PortalMe } from '../../_shared/types'

export async function getPortalProfile(): Promise<PortalMe> {
  const res = await portalApiClient.get<Envelope<PortalMe>>('/customer/me')
  return unwrap(res.data)
}

export async function changePortalPassword(payload: ChangePasswordRequest): Promise<void> {
  await portalApiClient.post('/customer/change-password', payload)
}
