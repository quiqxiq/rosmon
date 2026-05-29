import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type { RecordSaleParams, SaleFilters, SalesListParams } from './schema'

// Prefixes used for bulk invalidation after sale mutations. Any mutation
// that writes sales data should wipe every cached report — daily/monthly/
// resume/summary — since totals are recomputed server-side. `report` is
// router-agnostic at the prefix level because reports don't share their
// routerId in the same position across every key variant.
const reportPrefix = ['report'] as const
const voucherSessionPrefix = (rid: number) =>
  ['voucher', 'session', rid] as const
// Sales-list prefix — wipes every (range, page, filter) combo for the
// router after a write. Sits under the broader `voucher` namespace so
// future voucher writes can adopt the same pattern.
const salesListPrefix = (rid: number) => ['voucher', 'sales', rid] as const

function invalidateReports(
  qc: ReturnType<typeof useQueryClient>,
  routerId: number,
): void {
  qc.invalidateQueries({ queryKey: reportPrefix })
  qc.invalidateQueries({ queryKey: voucherSessionPrefix(routerId) })
  qc.invalidateQueries({ queryKey: salesListPrefix(routerId) })
}

// ─────────────────── Queries ───────────────────

export function useDailyReport(
  routerId: number,
  date: string,
  filters?: SaleFilters,
) {
  return useQuery({
    queryKey: qk.reportDaily(routerId, date, filters),
    queryFn: () => svc.getDailyReport(routerId, date, filters),
    enabled: routerId > 0 && date.length > 0,
  })
}

export function useMonthlyReport(
  routerId: number,
  year: number,
  month: number,
) {
  return useQuery({
    queryKey: qk.reportMonthly(routerId, year, month),
    queryFn: () => svc.getMonthlyReport(routerId, year, month),
    enabled: routerId > 0 && year > 0 && month >= 1 && month <= 12,
  })
}

export function useResumeReport(routerId: number, year: number) {
  return useQuery({
    queryKey: qk.reportResume(routerId, year),
    queryFn: () => svc.getResumeReport(routerId, year),
    enabled: routerId > 0 && year > 0,
  })
}

export function useDashboardSummary(routerId: number) {
  return useQuery({
    queryKey: qk.reportSummary(routerId),
    queryFn: () => svc.getDashboardSummary(routerId),
    enabled: routerId > 0,
  })
}

// ─────────────────── Sales listing (mocked endpoint) ───────────────────
// Hook for the planned `GET /vouchers/sales` range endpoint. The mock
// already simulates pagination + filtering + ~150ms latency so React
// Query's loading/error states behave exactly as they will in prod.
export function useSalesList(routerId: number, params: SalesListParams) {
  return useQuery({
    queryKey: qk.salesList(routerId, params),
    queryFn: () => svc.listSales(routerId, params),
    enabled:
      routerId > 0 &&
      params.from.length > 0 &&
      params.to.length > 0 &&
      params.page > 0 &&
      params.page_size > 0,
    // Sales rows rarely move, but a freshly-recorded sale should appear
    // quickly — leave stale time at the default (0) and rely on
    // mutation-side invalidation.
  })
}

// ─────────────────── Mutations ───────────────────

export function useRecordSale(routerId: number) {
  const qc = useQueryClient()
  return useMutation<void, Error, RecordSaleParams>({
    mutationFn: (params) => svc.recordSale(routerId, params),
    onSuccess: () => invalidateReports(qc, routerId),
  })
}

export function useImportSales(routerId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => svc.importSales(routerId),
    onSuccess: () => invalidateReports(qc, routerId),
  })
}
