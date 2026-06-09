import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type { GenerateInvoiceInput, InvoiceListFilters } from './schema'

export function useInvoices(filters?: InvoiceListFilters) {
  return useQuery({
    queryKey: qk.invoices(filters),
    queryFn: () => svc.listInvoices(filters),
  })
}

export function useInvoice(id: number) {
  return useQuery({
    queryKey: qk.invoice(id),
    queryFn: () => svc.getInvoice(id),
    enabled: id > 0,
  })
}

export function useGenerateInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: GenerateInvoiceInput) => svc.generateInvoice(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  })
}

export function useCancelInvoice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => svc.cancelInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['payments'] })
    },
  })
}
