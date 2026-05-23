import { type MaybeRefOrGetter, toValue, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { reportsService } from '@/services/reports'
import { queryKeys } from '@/queries/query-keys'

export function useSalesQuery(
  deviceId: MaybeRefOrGetter<string | null>,
  from?: MaybeRefOrGetter<string | undefined>,
  to?: MaybeRefOrGetter<string | undefined>,
) {
  return useQuery({
    queryKey: computed(() => queryKeys.reports.sales(String(toValue(deviceId)), toValue(from), toValue(to))),
    queryFn: () => reportsService.listSales(String(toValue(deviceId)), toValue(from), toValue(to)),
    enabled: () => Boolean(toValue(deviceId)),
  })
}

export function useSalesSummaryQuery(deviceId: MaybeRefOrGetter<string | null>, date?: string) {
  return useQuery({
    queryKey: queryKeys.reports.summary(String(toValue(deviceId)), date),
    queryFn: () => reportsService.summary(String(toValue(deviceId)), date),
    enabled: () => Boolean(toValue(deviceId)),
  })
}
