import { type MaybeRefOrGetter, computed, toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { subscriptionsService } from '@/services/subscriptions'
import { queryKeys } from '@/queries/query-keys'
import type {
  SubscriptionCreateInput,
  SubscriptionListFilter,
  SubscriptionStatusPatchInput,
  SubscriptionUpdateInput,
} from '@/types/subscription'

export function useSubscriptionsQuery(
  filter: MaybeRefOrGetter<SubscriptionListFilter> = () => ({}),
) {
  const filterValue = computed(() => toValue(filter))
  return useQuery({
    queryKey: computed(() => queryKeys.subscriptions.list(filterValue.value)),
    queryFn: () => subscriptionsService.list(filterValue.value),
  })
}

export function useSubscriptionQuery(id: MaybeRefOrGetter<number | null>) {
  return useQuery({
    queryKey: computed(() => queryKeys.subscriptions.detail(Number(toValue(id) ?? 0))),
    queryFn: () => subscriptionsService.get(Number(toValue(id))),
    enabled: () => Boolean(toValue(id)),
  })
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>, customerId?: number) {
  qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all })
  if (customerId) {
    qc.invalidateQueries({ queryKey: queryKeys.customers.detail(customerId) })
  }
}

export function useCreateSubscriptionMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SubscriptionCreateInput) => subscriptionsService.create(input),
    onSuccess: (_, variables) => invalidateAll(qc, variables.customer_id),
  })
}

export function useUpdateSubscriptionMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: SubscriptionUpdateInput }) =>
      subscriptionsService.update(id, input),
    onSuccess: (res) => invalidateAll(qc, res.subscription.customer_id),
  })
}

export function usePatchSubscriptionStatusMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: SubscriptionStatusPatchInput }) =>
      subscriptionsService.patchStatus(id, input),
    onSuccess: (res) => invalidateAll(qc, res.subscription.customer_id),
  })
}

export function useReconcileSubscriptionMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => subscriptionsService.reconcile(id),
    onSuccess: (res) => invalidateAll(qc, res.subscription.customer_id),
  })
}

export function useRemoveSubscriptionMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => subscriptionsService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.subscriptions.all })
    },
  })
}
