import { type ColumnDef } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { DataTableColumnHeader } from '@/components/data-table'
import { type RouterPPPProfile } from '../api/schema'
import { DataTableRowActions } from './data-table-row-actions'

export const columns: ColumnDef<RouterPPPProfile>[] = [
  {
    // Hidden filter-only column: feeds the "Status" faceted filter in the
    // toolbar. The status itself is surfaced as a coloured dot on the Name
    // cell below, so this column is never rendered.
    id: 'status',
    accessorFn: (row) => (row.disabled ? 'disabled' : 'enabled'),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    enableSorting: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => {
      const enabled = !row.original.disabled
      return (
        <span className='inline-flex items-center gap-2 font-semibold'>
          <span
            className={cn(
              'inline-block size-2 rounded-full',
              enabled ? 'bg-emerald-500' : 'bg-red-500'
            )}
            title={enabled ? 'Enabled' : 'Disabled'}
          />
          {row.original.name}
        </span>
      )
    },
    enableHiding: false,
  },
  {
    accessorKey: 'rate_limit',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Rate Limit' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-sm'>
        {row.original.rate_limit || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'local_address',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Local' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-sm'>
        {row.original.local_address || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'remote_address',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Remote' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-sm'>
        {row.original.remote_address || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'parent_queue',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Parent Queue' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-xs text-muted-foreground'>
        {row.original.parent_queue || '—'}
      </span>
    ),
  },
  {
    id: 'actions',
    cell: DataTableRowActions,
  },
]
