import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import { listPortalInvoices, getPortalInvoice } from './service'

export function usePortalInvoices(filters?: { status?: string }) {
  return useQuery({
    queryKey: qk.portalInvoices(filters),
    queryFn: () => listPortalInvoices(filters),
    staleTime: 30_000,
  })
}

export function usePortalInvoice(id: number) {
  return useQuery({
    queryKey: qk.portalInvoice(id),
    queryFn: () => getPortalInvoice(id),
    enabled: id > 0,
  })
}
