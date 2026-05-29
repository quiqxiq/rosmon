import { type ColumnDef } from '@tanstack/react-table'
import { Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { ConfirmDeleteButton } from '@/components/confirm-delete-button'
import { parseAPIError } from '@/lib/api/errors'
import { useRemoveCustomer } from '../api/queries'
import { useCustomersDialogStore } from '../store/customers-dialog-store'
import { type Customer } from '../api/schema'

function RowActions({ customer }: { customer: Customer }) {
  const openDialog = useCustomersDialogStore((s) => s.open)
  const removeMutation = useRemoveCustomer()
  return (
    <div className='flex justify-end gap-1'>
      <Button
        variant='ghost'
        size='icon'
        className='size-8'
        onClick={() => openDialog('edit', customer)}
        aria-label='Edit'
      >
        <Pencil className='size-4' />
      </Button>
      <ConfirmDeleteButton
        title='Remove customer?'
        description={`Customer '${customer.full_name}' will be removed. Active subscriptions must be removed first.`}
        pending={removeMutation.isPending}
        onConfirm={async () => {
          try {
            await removeMutation.mutateAsync(customer.id)
            toast.success(`Customer '${customer.full_name}' removed`)
          } catch (err) {
            toast.error('Failed to remove customer', {
              description: parseAPIError(err),
            })
          }
        }}
      />
    </div>
  )
}

export const columns: ColumnDef<Customer, unknown>[] = [
  {
    accessorKey: 'full_name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => (
      <span className='font-semibold'>{row.original.full_name}</span>
    ),
  },
  {
    accessorKey: 'phone',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Phone' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-sm'>{row.original.phone}</span>
    ),
  },
  {
    accessorKey: 'area',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Area' />
    ),
    cell: ({ row }) => <span>{row.original.area || '—'}</span>,
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={row.original.status === 'aktif' ? 'online' : 'offline'}>
        {row.original.status}
      </Badge>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: 'actions',
    cell: ({ row }) => <RowActions customer={row.original} />,
  },
]
