import { useQuery } from '@tanstack/react-query'
import { useSSE, type UseSSEResult } from '@/lib/api/sse'
import { useAuthStore } from '@/stores/auth-store'
import { sseLogToLogEntry } from '../data/data'
import type { LogEntry } from '../data/schema'
import type { LogEvent } from './schema'
import { listLogEntries } from './service'

// Backlog buffer (REST). Seed awal sebelum SSE follow menambah entri baru.
// Topic filter dilakukan client-side (lihat filterLogs), jadi backlog selalu
// di-fetch penuh per router.
export function useLogBacklog(routerId: number) {
  return useQuery({
    queryKey: ['log', 'backlog', routerId] as const,
    queryFn: () => listLogEntries(routerId),
    enabled: routerId > 0,
  })
}

export function useLogStream(
  routerId: number,
  onEntry: (entry: LogEntry) => void,
): UseSSEResult {
  // Stream semua entri log baru (follow-only); filter topic client-side.
  return useSSE<LogEvent>(
    routerId > 0 ? `/devices/${routerId}/stream/log` : null,
    (event) => onEntry(sseLogToLogEntry(event as LogEvent)),
    { getToken: () => useAuthStore.getState().auth.accessToken, events: ['log'] },
  )
}
