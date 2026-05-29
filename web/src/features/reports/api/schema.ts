import { z } from 'zod'

// dto.TransactionResponse
export const TransactionSchema = z.object({
  id: z.number(),
  sale_date: z.string(),
  sale_time: z.string(),
  sale_month: z.string(),
  username: z.string(),
  price: z.number(),
  sell_price: z.number(),
  ip: z.string().optional(),
  mac: z.string().optional(),
  validity: z.string().optional(),
  profile: z.string().optional(),
  comment: z.string().optional(),
  created_at: z.string(),
})
export type Transaction = z.infer<typeof TransactionSchema>

// dto.ReportTodayResponse
export type ReportToday = {
  date: string
  count: number
  transactions: Transaction[]
}

// dto.ReportSummary
export type ReportSummary = {
  count: number
  total_price: number
  total_sell_price: number
  profit: number
  by_profile?: Record<string, number>
  transactions?: Transaction[]
}
