import { useMutation, useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import { getPortalInvoice, initiateOnlinePayment, listPortalInvoices, getPaymentGatewayStatus, uploadProof, createPortalPayment, CreatePortalPaymentInput } from './service'

export function usePortalInvoices(filters?: { status?: string }) {
  return useQuery({
    queryKey: qk.portalInvoices(filters),
    queryFn: () => listPortalInvoices(filters),
    staleTime: 30_000,
  })
}

export function usePortalInvoice(id: number) {
  return useQuery({
    queryKey: qk.portalInvoice(id),
    queryFn: () => getPortalInvoice(id),
    enabled: id > 0,
  })
}

/**
 * Mutation untuk memulai pembayaran online via Xendit.
 * onSuccess: redirect ke invoice_url yang dikembalikan backend.
 */
export function useInitiateOnlinePayment() {
  return useMutation({
    mutationFn: (invoiceId: number) => initiateOnlinePayment(invoiceId),
  })
}

export function usePaymentGatewayStatus() {
  return useQuery({
    queryKey: ['portal', 'payment-gateway', 'status'],
    queryFn: getPaymentGatewayStatus,
    staleTime: 60_000,
  })
}

export function useUploadProof() {
  return useMutation({
    mutationFn: (file: File) => uploadProof(file),
  })
}

export function useCreatePortalPayment() {
  return useMutation({
    mutationFn: ({ invoiceId, input }: { invoiceId: number; input: CreatePortalPaymentInput }) =>
      createPortalPayment(invoiceId, input),
  })
}
