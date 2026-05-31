import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import { portalApiClient } from '@/lib/api/portal-client'
import type { PortalInvoice } from '../../_shared/types'

export async function listPortalInvoices(filters?: {
  status?: string
}): Promise<PortalInvoice[]> {
  const res = await portalApiClient.get<Envelope<PortalInvoice[]>>('/customer/invoices', {
    params: filters,
  })
  return unwrap(res.data)
}

export async function getPortalInvoice(id: number): Promise<PortalInvoice> {
  const res = await portalApiClient.get<Envelope<PortalInvoice>>(`/customer/invoices/${id}`)
  return unwrap(res.data)
}
