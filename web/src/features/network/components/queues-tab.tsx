import { type ColumnDef } from '@tanstack/react-table'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader, SimpleDataTable } from '@/components/data-table'
import { ConfirmDeleteButton } from '@/components/confirm-delete-button'
import { parseAPIError } from '@/lib/api/errors'
import { useDeleteQueue, useQueues } from '../api/queries'
import { type SimpleQueue } from '../api/schema'

export function QueuesTab() {
  const routerId = useActiveRouterId() ?? 0
  const queuesQuery = useQueues(routerId)
  const deleteMutation = useDeleteQueue(routerId)

  const columns: ColumnDef<SimpleQueue, unknown>[] = [
    {
      accessorKey: 'name',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Name' />
      ),
      cell: ({ row }) => (
        <span className='font-semibold'>{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'target',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Target' />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-xs'>{row.original.target || '—'}</span>
      ),
    },
    {
      accessorKey: 'max_limit',
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title='Max Limit' />
      ),
      cell: ({ row }) => (
        <span className='font-mono text-xs'>
          {row.original.max_limit || '—'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.disabled ? 'offline' : 'online'}>
          {row.original.disabled ? 'disabled' : 'enabled'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <ConfirmDeleteButton
          title='Remove queue?'
          description={`Queue '${row.original.name}' will be removed from RouterOS.`}
          pending={deleteMutation.isPending}
          onConfirm={async () => {
            try {
              await deleteMutation.mutateAsync(row.original.id)
              toast.success(`Queue '${row.original.name}' removed`)
            } catch (err) {
              toast.error('Failed to remove queue', {
                description: parseAPIError(err),
              })
            }
          }}
        />
      ),
    },
  ]

  return (
    <SimpleDataTable
      columns={columns}
      data={queuesQuery.data ?? []}
      searchKey='name'
      searchPlaceholder='Search queues...'
      emptyMessage='No static simple queues.'
    />
  )
}
