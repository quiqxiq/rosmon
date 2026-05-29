import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { type HotspotHostViewModel } from './view-model'
import { DataTableRowActions } from './data-table-row-actions'

export const columns: ColumnDef<HotspotHostViewModel>[] = [
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
    id: 'authorized',
    accessorFn: (row) => String(row.authorized),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Authorized' />
    ),
    cell: ({ row }) =>
      row.original.authorized ? (
        <Badge variant='online'>
          <span className='text-[8px]'>●</span>
          authorized
        </Badge>
      ) : (
        <Badge variant='outline' className='text-muted-foreground'>
          —
        </Badge>
      ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
    enableSorting: false,
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
    accessorKey: 'toAddress',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='To Address' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-sm'>{row.original.toAddress || '—'}</span>
    ),
  },
  {
    accessorKey: 'server',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Server' />
    ),
    cell: ({ row }) =>
      row.original.server ? (
        <Badge variant='outline' className='font-mono'>
          {row.original.server}
        </Badge>
      ) : (
        <span className='text-muted-foreground'>—</span>
      ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'comment',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Comment' />
    ),
    cell: ({ row }) => {
      const c = row.original.comment
      return c ? (
        <span className='text-sm text-muted-foreground'>{c}</span>
      ) : (
        <span className='text-muted-foreground'>—</span>
      )
    },
  },
  {
    id: 'actions',
    cell: DataTableRowActions,
  },
]
