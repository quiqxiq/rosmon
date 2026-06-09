import { type ColumnDef } from '@tanstack/react-table'
import { Eye } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatDateTime } from '@/lib/format'
import { useAuditLogDialogStore } from '../store/dialog-store'
import { type AuditLog } from '../api/schema'

function RowActions({ log }: { log: AuditLog }) {
  const open = useAuditLogDialogStore((s) => s.open)
  return (
    <div className='flex justify-end gap-1'>
      <Button
        variant='ghost'
        size='icon'
        className='size-8'
        onClick={() => open(log)}
        aria-label='View detail'
      >
        <Eye className='size-4' />
      </Button>
    </div>
  )
}

export const columns: ColumnDef<AuditLog, unknown>[] = [
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
    accessorKey: 'action',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Action' />
    ),
    cell: ({ row }) => (
      <Badge variant='outline' className='font-mono text-xs'>
        {row.original.action}
      </Badge>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'entity_type',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Entity' />
    ),
    cell: ({ row }) => (
      <span className='text-sm'>
        {row.original.entity_type}
        {row.original.entity_id ? (
          <span className='text-muted-foreground'> #{row.original.entity_id}</span>
        ) : null}
      </span>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'user_id',
    header: 'User',
    enableSorting: false,
    cell: ({ row }) => (
      <span className='text-sm text-muted-foreground'>
        {row.original.user_id ? `#${row.original.user_id}` : 'system'}
      </span>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => <RowActions log={row.original} />,
  },
]
