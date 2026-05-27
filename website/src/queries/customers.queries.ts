import { type MaybeRefOrGetter, computed, toValue } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { customersService } from '@/services/customers'
import { queryKeys } from '@/queries/query-keys'
import type {
  CustomerCreateInput,
  CustomerListFilter,
  CustomerUpdateInput,
} from '@/types/customer'

export function useCustomersQuery(filter: MaybeRefOrGetter<CustomerListFilter> = () => ({})) {
  const filterValue = computed(() => toValue(filter))
  return useQuery({
    queryKey: computed(() => queryKeys.customers.list(filterValue.value)),
    queryFn: () => customersService.list(filterValue.value),
  })
}

export function useCustomerQuery(id: MaybeRefOrGetter<number | null>) {
  return useQuery({
    queryKey: computed(() => queryKeys.customers.detail(Number(toValue(id) ?? 0))),
    queryFn: () => customersService.get(Number(toValue(id))),
    enabled: () => Boolean(toValue(id)),
  })
}

export function useCreateCustomerMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CustomerCreateInput) => customersService.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.customers.all })
    },
  })
}

export function useUpdateCustomerMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: CustomerUpdateInput }) =>
      customersService.update(id, input),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.customers.all })
      qc.invalidateQueries({ queryKey: queryKeys.customers.detail(variables.id) })
    },
  })
}

export function useRemoveCustomerMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => customersService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.customers.all })
    },
  })
}
