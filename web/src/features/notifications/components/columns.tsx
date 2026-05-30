import { type ColumnDef } from '@tanstack/react-table'
import { Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatDateTime } from '@/lib/format'
import { useNotificationDialogStore } from '../store/dialog-store'
import { type NotificationLog } from '../api/schema'

export function statusVariant(status: string) {
  switch (status) {
    case 'sent':
      return 'online' as const
    case 'failed':
      return 'expired' as const
    case 'pending':
      return 'idle' as const
    default:
      return 'offline' as const
  }
}

function RowActions({ log }: { log: NotificationLog }) {
  const open = useNotificationDialogStore((s) => s.open)
  return (
    <div className='flex justify-end gap-1'>
      <Button
        variant='ghost'
        size='icon'
        className='size-8'
        onClick={() => open(log)}
        aria-label='View message'
      >
        <Eye className='size-4' />
      </Button>
    </div>
  )
}

export const columns: ColumnDef<NotificationLog, unknown>[] = [
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='When' />
    ),
    cell: ({ row }) => (
      <span className='whitespace-nowrap text-sm text-muted-foreground'>
        {formatDateTime(new Date(row.original.created_at))}
      </span>
    ),
  },
  {
    accessorKey: 'template_slug',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Template' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-sm'>{row.original.template_slug}</span>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'recipient_phone',
    header: 'Recipient',
    cell: ({ row }) => (
      <span className='font-mono text-sm'>{row.original.recipient_phone}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={statusVariant(row.original.status)}>
        {row.original.status}
      </Badge>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'retry_count',
    header: 'Retries',
    cell: ({ row }) => (
      <span className='text-sm tabular-nums'>{row.original.retry_count}</span>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => <RowActions log={row.original} />,
  },
]
