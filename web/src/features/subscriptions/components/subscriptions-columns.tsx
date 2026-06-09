import { type ColumnDef } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/data-table'
import { STATUS_TONE } from '../data/data'
import { type Subscription, type SubscriptionStatus } from '../data/schema'
import { DataTableRowActions } from './data-table-row-actions'

export function subscriptionsColumns(
  customerName: (id: number) => string,
): ColumnDef<Subscription, unknown>[] {
  return [
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
      meta: {
        className: cn('inset-s-0 z-10 rounded-tl-[inherit] max-md:sticky'),
      },
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
      accessorKey: 'mikrotik_username',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Username' />
      ),
      cell: ({ row }) => (
        <div className='flex flex-col'>
          <span className='font-mono font-semibold'>
            {row.original.mikrotik_username}
          </span>
          <span className='text-xs text-muted-foreground'>
            {customerName(row.original.customer_id)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'service_type',
      header: 'Service',
      cell: ({ row }) => (
        <Badge variant='outline' className='uppercase'>
          {row.original.service_type}
        </Badge>
      ),
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={STATUS_TONE[row.original.status as SubscriptionStatus] ?? 'offline'}>
          {row.original.status}
        </Badge>
      ),
      filterFn: (row, id, value) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: 'sync_status',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Sync' />
      ),
      cell: ({ row }) => (
        <span
          className='font-mono text-xs text-muted-foreground'
          title={row.original.sync_notes}
        >
          {row.original.sync_status || '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => <DataTableRowActions row={row} />,
    },
  ]
}
