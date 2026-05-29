import { type ColumnDef } from '@tanstack/react-table'
import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Pencil, RefreshCw, SlidersHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTableColumnHeader } from '@/components/data-table'
import { parseAPIError } from '@/lib/api/errors'
import {
  useReconcileSubscription,
  useRemoveSubscription,
} from '../api/queries'
import { useSubscriptionsDialogStore } from '../store/dialog-store'
import { type Subscription } from '../api/schema'

const STATUS_TONE: Record<string, 'online' | 'offline'> = {
  active: 'online',
  pending_install: 'offline',
  isolir: 'offline',
  suspended: 'offline',
  terminated: 'offline',
}

function RowActions({ sub }: { sub: Subscription }) {
  const openDialog = useSubscriptionsDialogStore((s) => s.open)
  const reconcileMutation = useReconcileSubscription()
  const removeMutation = useRemoveSubscription()

  const handleReconcile = () => {
    reconcileMutation.mutate(sub.id, {
      onSuccess: (res) =>
        toast.success(`Reconciled '${sub.mikrotik_username}'`, {
          description: res.warning,
        }),
      onError: (err) =>
        toast.error('Reconcile failed', { description: parseAPIError(err) }),
    })
  }

  const handleRemove = () => {
    removeMutation.mutate(sub.id, {
      onSuccess: () => toast.success(`Subscription removed`),
      onError: (err) =>
        toast.error('Failed to remove', { description: parseAPIError(err) }),
    })
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='flex h-8 w-8 p-0'>
          <DotsHorizontalIcon className='h-4 w-4' />
          <span className='sr-only'>Open menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-48'>
        <DropdownMenuItem onClick={() => openDialog('edit', sub)}>
          <Pencil className='size-4' />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openDialog('status', sub)}>
          <SlidersHorizontal className='size-4' />
          Change Status
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleReconcile}
          disabled={reconcileMutation.isPending}
        >
          <RefreshCw className='size-4' />
          Reconcile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleRemove}
          disabled={removeMutation.isPending}
          className='text-red-500!'
        >
          <Trash2 className='size-4' />
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function makeColumns(
  customerName: (id: number) => string,
): ColumnDef<Subscription, unknown>[] {
  return [
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
        <Badge variant={STATUS_TONE[row.original.status] ?? 'offline'}>
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
      cell: ({ row }) => <RowActions sub={row.original} />,
    },
  ]
}
