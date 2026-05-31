import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import { listPortalSubscriptions, getPortalSubscriptionStatus } from './service'

export function usePortalSubscriptions() {
  return useQuery({
    queryKey: qk.portalSubscriptions(),
    queryFn: listPortalSubscriptions,
    staleTime: 60_000,
  })
}

export function usePortalSubscriptionStatus(id: number) {
  return useQuery({
    queryKey: qk.portalSubscription(id),
    queryFn: () => getPortalSubscriptionStatus(id),
    enabled: id > 0,
    refetchInterval: 30_000,
  })
}
