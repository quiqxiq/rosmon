import { z } from 'zod'

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled'

export const InvoiceSchema = z.object({
  id: z.number(),
  invoice_number: z.string(),
  customer_id: z.number(),
  subscription_id: z.number(),
  amount: z.number(),
  period_start: z.string(),
  period_end: z.string(),
  due_date: z.string(),
  status: z.string(),
  issued_at: z.string().nullable().optional(),
  paid_at: z.string().nullable().optional(),
  notes: z.string(),
  payment_code: z.string().optional(),
  qr_content: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})
export type Invoice = z.infer<typeof InvoiceSchema>

export type InvoiceListFilters = {
  status?: string
  customer_id?: number
  subscription_id?: number
  /** Filter berdasarkan bulan periode tagihan (period_start). year wajib bersama month. */
  year?: number
  month?: number
}

export type GenerateInvoiceInput = {
  subscription_id: number
  customer_id: number
  /** Opsional — kosong = backend pakai harga paket subscription. */
  amount?: number
  period_start: string
  due_days?: number
}
