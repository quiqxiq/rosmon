import { z } from 'zod'

export type PaymentMethod = 'cash' | 'manual_transfer' | 'xendit'
export type PaymentStatus = 'pending' | 'confirmed' | 'rejected'

export const PaymentSchema = z.object({
  id: z.number(),
  invoice_id: z.number(),
  customer_id: z.number(),
  amount: z.number(),
  method: z.string(),
  reference_number: z.string().optional(),
  proof_url: z.string().optional(),
  bank_name: z.string().optional(),
  status: z.string(),
  confirmed_by: z.number().nullable().optional(),
  confirmed_at: z.string().nullable().optional(),
  rejection_reason: z.string().optional(),
  gateway_name: z.string().optional(),
  invoice_url: z.string().optional(),
  expires_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Payment = z.infer<typeof PaymentSchema>

export type PaymentListFilters = {
  status?: string
  invoice_id?: number
  customer_id?: number
}

export type CreatePaymentInput = {
  invoice_id: number
  customer_id: number
  amount: number
  method: 'cash' | 'manual_transfer'
  reference_number?: string
  bank_name?: string
  proof_url?: string
}

export type CollectByCodeInput = {
  code: string
  method?: string
}

export type CollectByCodeResult = {
  payment: Payment
  invoice: {
    id: number
    invoice_number: string
    amount: number
    status: string
  }
}
