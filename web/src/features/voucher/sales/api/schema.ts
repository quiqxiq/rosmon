import { z } from 'zod'

// Source: internal/services/voucher_service.go#/RecordSaleParams.
// The backend deduplicates via `idempotency_key = hash(router+user+time)`
// server-side, so the client does NOT need to pass one — just fill what
// it knows. `sold_at` defaults to server-now when omitted.
export const RecordSaleParamsSchema = z.object({
  username: z.string().min(1).max(64),
  profile_name: z.string().max(64).optional(),
  price: z.number().int().min(0).optional(),
  validity: z.string().max(20).optional(),
  server: z.string().max(64).optional(),
  ip_address: z.string().max(45).optional(),
  mac_address: z.string().max(17).optional(),
  sold_at: z.string().datetime().optional(),
})
export type RecordSaleParams = z.infer<typeof RecordSaleParamsSchema>

// Source: internal/models/voucher_sale.go.
export const VoucherSaleSchema = z.object({
  id: z.number().int(),
  router_id: z.number().int().nullable(),
  sold_at: z.string(),
  username: z.string(),
  profile_name: z.string(),
  price: z.number().int(),
  selling_price: z.number().int(),
  server: z.string(),
  ip_address: z.string(),
  mac_address: z.string(),
  validity: z.string(),
  idempotency_key: z.string(),
  created_at: z.string(),
})
export type VoucherSale = z.infer<typeof VoucherSaleSchema>

// Source: internal/services/voucher_service.go#/ImportResult.
export const ImportResultSchema = z.object({
  total: z.number().int(),
  imported: z.number().int(),
  skipped: z.number().int(),
  errors: z.number().int(),
})
export type ImportResult = z.infer<typeof ImportResultSchema>

// Source: internal/services/report_service.go#/SaleFilters.
// All three fields are plain query-string params on the reports endpoints.
export type SaleFilters = {
  profile?: string
  server?: string
  search?: string
}

// Source: internal/services/report_service.go#/{DailyReport,MonthlyReport,...}.
export const DailySummaryRowSchema = z.object({
  date: z.string(),
  count: z.number().int(),
  sum: z.number().int(),
})
export type DailySummaryRow = z.infer<typeof DailySummaryRowSchema>

export const DailyReportSchema = z.object({
  date: z.string(),
  sales: z.array(VoucherSaleSchema),
  total: z.number().int(),
  count: z.number().int(),
})
export type DailyReport = z.infer<typeof DailyReportSchema>

export const MonthlyReportSchema = z.object({
  year: z.number().int(),
  month: z.number().int(),
  daily: z.array(DailySummaryRowSchema),
  total: z.number().int(),
  count: z.number().int(),
})
export type MonthlyReport = z.infer<typeof MonthlyReportSchema>

export const ResumeReportSchema = z.object({
  year: z.number().int(),
  monthly: z.array(
    z.object({
      month: z.number().int(),
      count: z.number().int(),
      sum: z.number().int(),
    }),
  ),
  total: z.number().int(),
  count: z.number().int(),
})
export type ResumeReport = z.infer<typeof ResumeReportSchema>

export const DashboardSummarySchema = z.object({
  today_count: z.number().int(),
  today_sum: z.number().int(),
  month_count: z.number().int(),
  month_sum: z.number().int(),
})
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>

// ─────────────────── Sales listing (planned endpoint, mocked) ───────────────────
// Planned contract:
//   GET /routers/:routerId/vouchers/sales
//     ?from=YYYY-MM-DD&to=YYYY-MM-DD
//     &page=1&page_size=25
//     &search=&profile=&server=
//   → { items, total, page, page_size }
//
// Phase 6 ships a service-layer mock that satisfies this exact shape so
// the UI can be built against the final API. When the real endpoint
// lands, only `service.listSales()` needs to change.

export type SalesListParams = {
  from: string // YYYY-MM-DD, inclusive
  to: string // YYYY-MM-DD, inclusive
  page: number // 1-indexed
  page_size: number // 25 | 50 | 100
  search?: string
  profile?: string
  server?: string
}

export const SalesListResponseSchema = z.object({
  items: z.array(VoucherSaleSchema),
  total: z.number().int(),
  page: z.number().int(),
  page_size: z.number().int(),
  // Aggregate revenue across the filtered set — server-computed in the
  // real endpoint, computed in the mock to keep parity with what the
  // KPI cards expect.
  total_revenue: z.number().int(),
})
export type SalesListResponse = z.infer<typeof SalesListResponseSchema>
