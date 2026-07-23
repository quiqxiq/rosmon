import { type ColumnDef } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { type PPPSecret } from '../api/schema'
import { DataTableRowActions } from './data-table-row-actions'

export const columns: ColumnDef<PPPSecret>[] = [
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
    // Hidden filter-only column: feeds the "Status" faceted filter in the
    // toolbar. The status itself is surfaced as a coloured dot on the
    // Username cell below, so this column is never rendered.
    id: 'status',
    accessorFn: (row) => (row.disabled ? 'disabled' : 'enabled'),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Username' />
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
    accessorKey: 'service',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Service' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-sm'>{row.original.service || 'any'}</span>
    ),
  },
  {
    accessorKey: 'remote_address',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Remote Address' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-sm'>
        {row.original.remote_address || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'last_caller_id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Last Caller' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-xs text-muted-foreground'>
        {row.original.last_caller_id || '—'}
      </span>
    ),
  },
  {
    id: 'actions',
    cell: DataTableRowActions,
  },
]
