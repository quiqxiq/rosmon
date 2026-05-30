import { useQuery } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import * as svc from './service'
import type { NotificationLogFilters } from './schema'

export function useNotifications(filters?: NotificationLogFilters) {
  return useQuery({
    queryKey: qk.notificationsLog(filters),
    queryFn: () => svc.listNotifications(filters),
  })
}
