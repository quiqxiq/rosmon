import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type {
  SubscriptionCreateInput,
  SubscriptionListFilters,
  SubscriptionUpdateInput,
} from './schema'

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
