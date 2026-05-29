import { apiClient } from '@/lib/api/client'
import type { Envelope, MessageResult } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import { generateMockSales } from './mock'
import type {
  DailyReport,
  DashboardSummary,
  ImportResult,
  MonthlyReport,
  RecordSaleParams,
  ResumeReport,
  SaleFilters,
  SalesListParams,
  SalesListResponse,
} from './schema'

const voucherBase = (rid: number) => `/devices/${rid}/vouchers`
const reportsBase = (rid: number) => `/devices/${rid}/reports`

// ─────────────────── Sales mutations ───────────────────

// POST /routers/:routerId/vouchers/sales — idempotent insert. The backend
// returns `{ message: "sale recorded" }`; we discard it since the UI just
// needs to know the call succeeded.
export async function recordSale(
  routerId: number,
  params: RecordSaleParams,
): Promise<void> {
  await apiClient.post<Envelope<MessageResult>>(
    `${voucherBase(routerId)}/sales`,
    params,
  )
}

// POST /routers/:routerId/vouchers/import — pulls sales records written
// by on-login scripts into /system/script and syncs them to the DB. Safe
// to call repeatedly — duplicate idempotency keys are skipped.
export async function importSales(routerId: number): Promise<ImportResult> {
  const res = await apiClient.post<Envelope<ImportResult>>(
    `${voucherBase(routerId)}/import`,
  )
  return unwrap(res.data)
}

// ─────────────────── Report queries ───────────────────

// GET /routers/:routerId/reports/daily?date=YYYY-MM-DD&profile=&server=&search=
// Sales list is returned inline alongside the day totals.
export async function getDailyReport(
  routerId: number,
  date: string,
  filters?: SaleFilters,
): Promise<DailyReport> {
  const res = await apiClient.get<Envelope<DailyReport>>(
    `${reportsBase(routerId)}/daily`,
    { params: { date, ...filters } },
  )
  return unwrap(res.data)
}

// GET /routers/:routerId/reports/monthly?year=&month= — aggregated month
// view with per-day breakdown. `month` is 1-12.
export async function getMonthlyReport(
  routerId: number,
  year: number,
  month: number,
): Promise<MonthlyReport> {
  const res = await apiClient.get<Envelope<MonthlyReport>>(
    `${reportsBase(routerId)}/monthly`,
    { params: { year, month } },
  )
  return unwrap(res.data)
}

// GET /routers/:routerId/reports/resume?year= — year overview, one row
// per month. Used by the yearly summary page.
export async function getResumeReport(
  routerId: number,
  year: number,
): Promise<ResumeReport> {
  const res = await apiClient.get<Envelope<ResumeReport>>(
    `${reportsBase(routerId)}/resume`,
    { params: { year } },
  )
  return unwrap(res.data)
}

// GET /routers/:routerId/reports/summary — "today + this month" at-a-glance
// counters powering the dashboard header.
export async function getDashboardSummary(
  routerId: number,
): Promise<DashboardSummary> {
  const res = await apiClient.get<Envelope<DashboardSummary>>(
    `${reportsBase(routerId)}/summary`,
  )
  return unwrap(res.data)
}

// ─────────────────── Report exports (blobs) ───────────────────

// GET /routers/:routerId/reports/export/csv?from=&to=&profile=&server=
// Exposed as a plain async function, not a hook — the UI triggers a file
// download via `URL.createObjectURL(blob)` and an anchor click.
export async function exportSalesCSV(
  routerId: number,
  from: string,
  to: string,
  filters?: SaleFilters,
): Promise<Blob> {
  const res = await apiClient.get<Blob>(
    `${reportsBase(routerId)}/export/csv`,
    {
      params: { from, to, ...filters },
      responseType: 'blob',
    },
  )
  return res.data
}

// GET /routers/:routerId/reports/export/excel?from=&to=&profile=&server=
// Same download pattern as CSV. MIME:
// `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.
export async function exportSalesExcel(
  routerId: number,
  from: string,
  to: string,
  filters?: SaleFilters,
): Promise<Blob> {
  const res = await apiClient.get<Blob>(
    `${reportsBase(routerId)}/export/excel`,
    {
      params: { from, to, ...filters },
      responseType: 'blob',
    },
  )
  return res.data
}

// ─────────────────── Sales listing (MOCKED — Phase 6) ───────────────────

// TODO(backend): replace this mock once the real endpoint lands:
//   GET /routers/:routerId/vouchers/sales
//     ?from=&to=&page=&page_size=&search=&profile=&server=
// The mock honors the same params + pagination + filtering semantics so
// the UI doesn't need to change — only this function body does.
//
// `_routerId` is intentionally unused while mocked but kept in the
// signature so the real implementation can drop in without callers
// changing.
export async function listSales(
  _routerId: number,
  params: SalesListParams,
): Promise<SalesListResponse> {
  // Simulate ~150ms of network latency so React Query's loading states
  // are visible in dev. Cheap and worth the realism.
  await new Promise((resolve) => setTimeout(resolve, 150))

  const { filtered, totalRevenue } = generateMockSales(params)

  // Apply pagination AFTER filtering — same order the real backend uses.
  const start = (params.page - 1) * params.page_size
  const items = filtered.slice(start, start + params.page_size)

  return {
    items,
    total: filtered.length,
    page: params.page,
    page_size: params.page_size,
    total_revenue: totalRevenue,
  }
}
