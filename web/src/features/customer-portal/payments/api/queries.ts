import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import { listPortalPayments } from './service'

export function usePortalPayments() {
  return useQuery({
    queryKey: qk.portalPayments(),
    queryFn: listPortalPayments,
    staleTime: 30_000,
  })
}
