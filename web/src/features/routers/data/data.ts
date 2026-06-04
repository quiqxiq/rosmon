import type { RouterPublicView } from '../api/schema'

// ── Status configuration ──────────────────────────────────────────────────

type RouterStatusKey = RouterPublicView['status']

export const routerStatusConfig: Record<
  RouterStatusKey,
  { label: string; color: string; variant: string }
> = {
  connected: { label: 'Connected', color: 'text-emerald-500', variant: 'online' },
  connecting: { label: 'Connecting', color: 'text-blue-500', variant: 'default' },
  unknown: { label: 'Unknown', color: 'text-gray-500', variant: 'secondary' },
  disconnected: { label: 'Disconnected', color: 'text-amber-500', variant: 'idle' },
  error: { label: 'Error', color: 'text-red-500', variant: 'destructive' },
}

// ── View-model type (defined here to avoid circular deps with components/) ─

export interface RouterViewModel {
  id: number
  name: string
  host: string
  port: number
  username: string
  status: RouterPublicView['status']
  statusLabel: string
  lastSeenAt: string
}
