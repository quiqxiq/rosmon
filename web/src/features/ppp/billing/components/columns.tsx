import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatIDR } from '@/lib/format'
import { type PPPDbProfile } from '../api/schema'
import { DataTableRowActions } from './data-table-row-actions'

export const columns: ColumnDef<PPPDbProfile>[] = [
  {
    id: 'status',
    accessorFn: (row) => (row.active ? 'active' : 'inactive'),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => {
      const active = row.original.active
      return (
        <Badge variant={active ? 'online' : 'offline'}>
          <span className='text-[8px]'>●</span>
          {active ? 'active' : 'inactive'}
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
      <div className='flex flex-col'>
        <span className='font-semibold'>{row.original.name}</span>
        {row.original.description ? (
          <span className='text-xs text-muted-foreground'>
            {row.original.description}
          </span>
        ) : null}
      </div>
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
    accessorKey: 'price_monthly',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Price / mo' />
    ),
    cell: ({ row }) => (
      <span className='font-medium'>
        {row.original.price_monthly > 0
          ? formatIDR(row.original.price_monthly)
          : '—'}
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
