import { type MaybeRefOrGetter, toValue } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { historyService } from '@/services/history'
import { queryKeys } from '@/queries/query-keys'
import type { HistoryQuery } from '@/types/history'

export function useHistoryQuery(deviceId: MaybeRefOrGetter<string | null>, query: HistoryQuery) {
  return useQuery({
    queryKey: queryKeys.history.query(String(toValue(deviceId)), JSON.stringify(query)),
    queryFn: () => historyService.query(String(toValue(deviceId)), query),
    enabled: () => Boolean(toValue(deviceId)),
  })
}
