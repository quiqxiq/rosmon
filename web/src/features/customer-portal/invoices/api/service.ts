import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import { portalApiClient } from '@/lib/api/portal-client'
import type { InitiatePaymentResponse, PortalInvoice } from '../../_shared/types'

export async function listPortalInvoices(filters?: {
  status?: string
}): Promise<PortalInvoice[]> {
  const res = await portalApiClient.get<Envelope<PortalInvoice[]>>('/customer/invoices', {
    params: filters,
  })
  return unwrap(res.data)
}

export async function getPortalInvoice(id: number): Promise<PortalInvoice> {
  const res = await portalApiClient.get<Envelope<PortalInvoice>>(`/customer/invoices/${id}`)
  return unwrap(res.data)
}

/**
 * Inisiasi pembayaran online via gateway (Xendit) untuk invoice tertentu.
 * Mengembalikan invoice_url untuk redirect ke halaman checkout.
 */
export async function initiateOnlinePayment(invoiceId: number): Promise<InitiatePaymentResponse> {
  const res = await portalApiClient.post<Envelope<InitiatePaymentResponse>>(
    `/customer/invoices/${invoiceId}/pay`,
  )
  return unwrap(res.data)
}

export interface PaymentGatewayStatus {
  enabled: boolean
}

export async function getPaymentGatewayStatus(): Promise<PaymentGatewayStatus> {
  const res = await portalApiClient.get<Envelope<PaymentGatewayStatus>>('/customer/payment-gateway/status')
  return unwrap(res.data)
}

export interface UploadProofResponse {
  url: string
}

export async function uploadProof(file: File): Promise<UploadProofResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await portalApiClient.post<Envelope<UploadProofResponse>>(
    '/customer/upload',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  )
  return unwrap(res.data)
}

export interface CreatePortalPaymentInput {
  proof_url: string
  bank_name: string
  reference_number: string
}

export async function createPortalPayment(
  invoiceId: number,
  input: CreatePortalPaymentInput,
): Promise<any> {
  const res = await portalApiClient.post<Envelope<any>>(
    `/customer/invoices/${invoiceId}/pay`,
    input,
  )
  return unwrap(res.data)
}
