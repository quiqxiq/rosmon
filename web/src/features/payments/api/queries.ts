import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type { CreatePaymentInput, CollectByCodeInput, PaymentListFilters } from './schema'

export function usePayments(filters?: PaymentListFilters) {
  return useQuery({
    queryKey: qk.payments(filters),
    queryFn: () => svc.listPayments(filters),
  })
}

export function useInvoicePayments(invoiceId: number) {
  return useQuery({
    queryKey: qk.invoicePayments(invoiceId),
    queryFn: () => svc.listPayments({ invoice_id: invoiceId }),
    enabled: invoiceId > 0,
  })
}

export function useCreatePayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePaymentInput) => svc.createPayment(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useConfirmPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => svc.confirmPayment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['subscriptions'] })
    },
  })
}

export function useRejectPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      svc.rejectPayment(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
    },
  })
}

export function useCollectByCode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CollectByCodeInput) => svc.collectByCode(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payments'] })
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['subscriptions'] })
    },
  })
}
