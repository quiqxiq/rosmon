import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
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
