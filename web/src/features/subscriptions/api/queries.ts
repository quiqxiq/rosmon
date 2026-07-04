import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import type {
  SubscriptionCreateInput,
  SubscriptionEnrichedItem,
  SubscriptionListFilters,
  SubscriptionUpdateInput,
} from './schema'
import * as svc from './service'

export function useSubscriptions(filters?: SubscriptionListFilters) {
  return useQuery({
    queryKey: qk.subscriptions(filters),
    queryFn: () => svc.listSubscriptions(filters),
  })
}

export function useCreateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SubscriptionCreateInput) =>
      svc.createSubscription(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  })
}

export function useUpdateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number
      payload: SubscriptionUpdateInput
    }) => svc.updateSubscription(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  })
}

export function usePatchSubscriptionStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      svc.patchSubscriptionStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  })
}

export function useReconcileSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => svc.reconcileSubscription(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  })
}

export function useRemoveSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => svc.removeSubscription(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  })
}

export function useSubscriptionsByDevice(deviceId: number) {
  return useQuery({
    queryKey: qk.subscriptionsByDevice(deviceId),
    queryFn: () => svc.listSubscriptionsByDevice(deviceId),
    enabled: deviceId > 0,
    refetchInterval: 30_000, // auto-refresh tiap 30 detik
    staleTime: 15_000,
  })
}
