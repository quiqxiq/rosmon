import { type ColumnDef } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatBytes } from '../../_shared/format'
import { type HotspotUserViewModel } from './view-model'
import { DataTableRowActions } from './data-table-row-actions'

// Date formatter for the Expiry column. Short, scannable, locale-aware.
const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric',
})

export const columns: ColumnDef<HotspotUserViewModel>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label='Select all'
        className='translate-y-0.5'
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label='Select row'
        className='translate-y-0.5'
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'enabledStatus',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => {
      const status = row.original.enabledStatus
      return (
        <Badge variant={status === 'enabled' ? 'online' : 'offline'}>
          <span className='text-[8px]'>●</span>
          {status}
        </Badge>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Username' />
    ),
    cell: ({ row }) => (
      <span className='font-semibold'>{row.original.name}</span>
    ),
    enableHiding: false,
  },
  {
    accessorKey: 'profile',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Profile' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-sm'>{row.original.profile || '—'}</span>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'macAddress',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='MAC Address' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-sm'>
        {row.original.macAddress || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'server',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Server' />
    ),
    cell: ({ row }) => <span>{row.original.server || '—'}</span>,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'uptime',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Uptime' />
    ),
    cell: ({ row }) => {
      const v = row.original.uptime
      return (
        <span className={cn('font-mono text-sm', !v && 'text-muted-foreground')}>
          {v || '—'}
        </span>
      )
    },
  },
  {
    id: 'expiry',
    accessorFn: (row) => row.expiry?.at.getTime() ?? 0,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Expiry' />
    ),
    cell: ({ row }) => {
      const exp = row.original.expiry
      if (!exp) return <span className='text-muted-foreground'>—</span>
      return (
        <div className='flex flex-col gap-0.5'>
          <span className='font-mono text-xs'>{dateFmt.format(exp.at)}</span>
          {exp.isPast && (
            <Badge variant='expired' className='w-fit text-[10px]'>
              Expired
            </Badge>
          )}
        </div>
      )
    },
  },
  {
    id: 'bytesTotal',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Traffic' />
    ),
    accessorFn: (row) => row.bytesIn + row.bytesOut,
    cell: ({ row }) => {
      const { bytesIn, bytesOut } = row.original
      if (bytesIn + bytesOut === 0) {
        return <span className='text-muted-foreground'>—</span>
      }
      return (
        <div className='font-mono text-xs'>
          <span className='text-sky-600 dark:text-sky-400'>
            ↓{formatBytes(bytesIn)}
          </span>
          {' '}
          <span className='text-violet-600 dark:text-violet-400'>
            ↑{formatBytes(bytesOut)}
          </span>
        </div>
      )
    },
  },
  {
    id: 'actions',
    cell: DataTableRowActions,
  },
]
