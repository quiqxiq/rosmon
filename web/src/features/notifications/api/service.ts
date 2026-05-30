import { apiClient } from '@/lib/api/client'
import type { Envelope } from '@/lib/api/types'
import { unwrap } from '@/lib/api/unwrap'
import type { NotificationLog, NotificationLogFilters } from './schema'

const base = '/notifications'

// GET /notifications — admin only. Sent-message log + retry status.
export async function listNotifications(
  filters?: NotificationLogFilters,
): Promise<NotificationLog[]> {
  const res = await apiClient.get<Envelope<NotificationLog[]>>(base, {
    params: filters,
  })
  return unwrap(res.data)
}
