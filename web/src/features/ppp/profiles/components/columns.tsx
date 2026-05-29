import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { type RouterPPPProfile } from '../api/schema'
import { DataTableRowActions } from './data-table-row-actions'

export const columns: ColumnDef<RouterPPPProfile>[] = [
  {
    id: 'status',
    accessorFn: (row) => (row.disabled ? 'disabled' : 'enabled'),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => {
      const enabled = !row.original.disabled
      return (
        <Badge variant={enabled ? 'online' : 'offline'}>
          <span className='text-[8px]'>●</span>
          {enabled ? 'enabled' : 'disabled'}
        </Badge>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    enableSorting: false,
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => (
      <span className='font-semibold'>{row.original.name}</span>
    ),
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
