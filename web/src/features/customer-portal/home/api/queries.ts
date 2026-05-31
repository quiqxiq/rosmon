import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import { getPortalMe } from './service'

export function usePortalMe() {
  return useQuery({
    queryKey: qk.portalMe(),
    queryFn: getPortalMe,
    staleTime: 60_000,
  })
}
