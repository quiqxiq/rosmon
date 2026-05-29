import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table'
import { type PPPActive } from '../api/schema'
import { DataTableRowActions } from './data-table-row-actions'

export const columns: ColumnDef<PPPActive>[] = [
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
    accessorKey: 'service',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Service' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-sm'>{row.original.service || '—'}</span>
    ),
  },
  {
    accessorKey: 'address',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Address' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-sm'>{row.original.address || '—'}</span>
    ),
  },
  {
    accessorKey: 'caller_id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Caller ID' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-xs text-muted-foreground'>
        {row.original.caller_id || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'uptime',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Uptime' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-sm'>{row.original.uptime || '—'}</span>
    ),
  },
  {
    id: 'actions',
    cell: DataTableRowActions,
  },
]
