import { type ColumnDef } from '@tanstack/react-table'
import { Check, UserPlus, Wrench, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatDate } from '@/lib/format'
import { useRegistrationsDialogStore } from '../store/dialog-store'
import { type Registration } from '../api/schema'

export function regStatusVariant(status: string) {
  switch (status) {
    case 'approved':
      return 'online' as const
    case 'rejected':
      return 'expired' as const
    case 'cancelled':
      return 'offline' as const
    default:
      return 'idle' as const // pending
  }
}

function RowActions({ reg }: { reg: Registration }) {
  const open = useRegistrationsDialogStore((s) => s.open)
  return (
    <div className='flex justify-end gap-1'>
      {reg.status === 'pending' && (
        <>
          <Button
            variant='ghost'
            size='icon'
            className='size-8 text-emerald-600'
            onClick={() => open('approve', reg)}
            aria-label='Approve'
          >
            <Check className='size-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='size-8 text-destructive'
            onClick={() => open('reject', reg)}
            aria-label='Reject'
          >
            <X className='size-4' />
          </Button>
        </>
      )}
      {reg.status === 'approved' && (
        <>
          <Button
            variant='ghost'
            size='icon'
            className='size-8'
            onClick={() => open('assign', reg)}
            aria-label='Assign technician'
          >
            <UserPlus className='size-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className='size-8 text-primary'
            onClick={() => open('complete', reg)}
            aria-label='Complete install'
          >
            <Wrench className='size-4' />
          </Button>
        </>
      )}
    </div>
  )
}

export const columns: ColumnDef<Registration, unknown>[] = [
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
    header: 'Phone',
    cell: ({ row }) => (
      <span className='font-mono text-sm'>{row.original.phone}</span>
    ),
  },
  {
    accessorKey: 'area',
    header: 'Area',
    cell: ({ row }) => <span>{row.original.area || '—'}</span>,
  },
  {
    accessorKey: 'service_type',
    header: 'Service',
    cell: ({ row }) =>
      row.original.service_type ? (
        <Badge variant='secondary'>{row.original.service_type}</Badge>
      ) : (
        <span className='text-muted-foreground'>—</span>
      ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant={regStatusVariant(row.original.status)}>
        {row.original.status}
      </Badge>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Submitted' />
    ),
    cell: ({ row }) => (
      <span className='whitespace-nowrap text-sm text-muted-foreground'>
        {formatDate(new Date(row.original.created_at))}
      </span>
    ),
  },
  {
    id: 'actions',
    cell: ({ row }) => <RowActions reg={row.original} />,
  },
]
