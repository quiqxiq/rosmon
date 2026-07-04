import { apiClient } from '@/lib/api/client'
import type { Envelope, MessageResult } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
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
    `${reportsBase(routerId)}/sales`,
    params,
  )
}

// POST /routers/:routerId/vouchers/import — pulls sales records written
// by on-login scripts into /system/script and syncs them to the DB. Safe
// to call repeatedly — duplicate idempotency keys are skipped.
export async function importSales(routerId: number): Promise<ImportResult> {
  const res = await apiClient.post<Envelope<ImportResult>>(
    `${reportsBase(routerId)}/import`,
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

// GET /routers/:routerId/reports/sales
//   ?from=&to=&page=&page_size=&search=&profile=&server=
export async function listSales(
  routerId: number,
  params: SalesListParams,
): Promise<SalesListResponse> {
  const res = await apiClient.get<Envelope<SalesListResponse>>(
    `${reportsBase(routerId)}/sales`,
    { params },
  )
  return unwrap(res.data)
}
