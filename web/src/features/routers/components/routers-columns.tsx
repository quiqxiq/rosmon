import { type ColumnDef, type Row } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import type { RouterPublicView } from '../api/schema'
import { routerStatusConfig } from '../data/data'
import { toRouterViewModel } from './view-model'
import { DataTableRowActions } from './data-table-row-actions'

export const routersColumns: ColumnDef<RouterPublicView>[] = [
  {
    accessorKey: 'display_name',
    header: 'Name',
    cell: ({ row }) => (
      <span className='font-medium'>{row.original.display_name}</span>
    ),
    enableSorting: true,
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ row }) => (
      <span className='font-mono text-xs text-muted-foreground'>
        {row.original.address}
      </span>
    ),
  },
  {
    accessorKey: 'username',
    header: 'Username',
    cell: ({ row }) => (
      <span className='text-sm'>{row.original.username}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.original.status
      const config = routerStatusConfig[status]
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium',
            config?.color ?? 'text-muted-foreground',
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              status === 'connected' && 'bg-emerald-500',
              status === 'disconnected' && 'bg-amber-500',
              status === 'error' && 'bg-red-500',
              status === 'unknown' && 'bg-gray-400',
            )}
          />
          {config?.label ?? status}
        </span>
      )
    },
  },
  {
    id: 'lastSeenAt',
    header: 'Last Seen',
    cell: ({ row }) => {
      const vm = toRouterViewModel(row.original)
      return (
        <span className='text-xs text-muted-foreground'>{vm.lastSeenAt}</span>
      )
    },
  },
  {
    id: 'actions',
    cell: ({ row }: { row: Row<RouterPublicView> }) => (
      <DataTableRowActions row={row} />
    ),
  },
]
