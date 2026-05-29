import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { type HotspotActiveViewModel } from './view-model'
import { DataTableRowActions } from './data-table-row-actions'

export const columns: ColumnDef<HotspotActiveViewModel>[] = [
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
    accessorKey: 'server',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Server' />
    ),
    cell: ({ row }) => (
      <Badge variant='outline' className='font-mono'>
        {row.original.server || '—'}
      </Badge>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'user',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='User' />
    ),
    cell: ({ row }) => (
      <span className='font-semibold'>{row.original.user || '—'}</span>
    ),
    enableHiding: false,
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
    accessorKey: 'macAddress',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='MAC' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-sm'>{row.original.macAddress || '—'}</span>
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
    accessorKey: 'sessionTimeLeft',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Time Left' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-sm'>
        {row.original.sessionTimeLeft || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'loginBy',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Login By' />
    ),
    cell: ({ row }) => {
      const v = row.original.loginBy
      return v ? (
        <Badge variant='outline' className='font-normal capitalize'>
          {v}
        </Badge>
      ) : (
        <span className='text-muted-foreground'>—</span>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: 'actions',
    cell: DataTableRowActions,
  },
]
