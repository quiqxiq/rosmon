import type { RouterPublicView } from '../api/schema'
import { routerStatusConfig, type RouterViewModel } from '../data/data'

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never'

  const now = Date.now()
  const last = new Date(dateStr).getTime()
  const diff = now - last

  if (diff < 0) return 'Just now'
  if (diff < 60_000) return 'Just now'

  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes} min ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`

  const months = Math.floor(days / 30)
  return `${months} month${months > 1 ? 's' : ''} ago`
}

export function toRouterViewModel(router: RouterPublicView): RouterViewModel {
  return {
    id: router.id,
    name: router.display_name,
    host: router.host,
    port: router.port,
    username: router.username,
    status: router.status,
    statusLabel: routerStatusConfig[router.status]?.label ?? 'Unknown',
    lastSeenAt: formatRelativeTime(router.last_seen),
  }
}
