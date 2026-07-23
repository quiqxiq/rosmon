import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type {
  CustomerCreateInput,
  CustomerListFilters,
  CustomerUpdateInput,
} from './schema'

export function useCustomers(filters?: CustomerListFilters) {
  return useQuery({
    queryKey: qk.customers(filters),
    queryFn: () => svc.listCustomers(filters),
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CustomerCreateInput) => svc.createCustomer(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useUpdateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CustomerUpdateInput }) =>
      svc.updateCustomer(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useRemoveCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => svc.removeCustomer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useBatchRemoveCustomers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) => svc.batchRemoveCustomers(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}
