import { useSSE, type UseSSEResult } from '@/lib/api/sse'
import { useAuthStore } from '@/stores/auth-store'
import { sseLogToLogEntry } from '../data/data'
import type { LogEntry } from '../data/schema'
import type { LogEvent } from './schema'

export function useLogStream(
  routerId: number,
  onEntry: (entry: LogEntry) => void,
): UseSSEResult {
  return useSSE<LogEvent>(
    routerId > 0 ? `/devices/${routerId}/stream/log` : null,
    (event) => onEntry(sseLogToLogEntry(event as LogEvent)),
    { getToken: () => useAuthStore.getState().auth.accessToken },
  )
}
