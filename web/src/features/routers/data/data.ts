import { type ColumnDef } from '@tanstack/react-table'
import type { RouterPublicView } from '../api/schema'

// ── Status configuration ──────────────────────────────────────────────────

type RouterStatusKey = RouterPublicView['status'] | 'connecting'

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
  ip_address: string
  api_port: number
  api_username: string
  status: RouterPublicView['status']
  statusLabel: string
  lastSeenAt: string
  notes: string | null
}

// ── TanStack Table column definitions ─────────────────────────────────────

export const routerColumns: ColumnDef<RouterViewModel>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    enableSorting: true,
  },
  {
    accessorKey: 'ip_address',
    header: 'IP Address',
  },
  {
    accessorKey: 'api_port',
    header: 'API Port',
  },
  {
    accessorKey: 'api_username',
    header: 'API Username',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status
      const config = routerStatusConfig[status]
      return config?.label ?? status
    },
  },
  {
    accessorKey: 'lastSeenAt',
    header: 'Last Seen',
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
    cell: ({ row }) => {
      const notes = row.original.notes
      if (!notes) return '\u2014'
      return notes.length > 50 ? notes.slice(0, 50) + '...' : notes
    },
  },
]
