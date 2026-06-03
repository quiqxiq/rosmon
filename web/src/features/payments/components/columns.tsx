import { type ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Banknote, Check, CreditCard, Globe, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatIDR } from '@/lib/format'
import type { Payment } from '../api/schema'
import { PaymentStatusBadge } from './payment-status-badge'

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return format(new Date(s), 'd MMM yy HH:mm', { locale: localeId })
}

function MethodIcon({ method }: { method: string }) {
  if (method === 'cash') return <Banknote className='size-3.5 text-emerald-500' />
  if (method === 'manual_transfer') return <CreditCard className='size-3.5 text-blue-500' />
  return <Globe className='size-3.5 text-violet-500' />
}

function methodLabel(method: string) {
  const labels: Record<string, string> = { cash: 'Tunai', manual_transfer: 'Transfer', xendit: 'Online' }
  return labels[method] ?? method
}

type Actions = {
  onConfirm: (p: Payment) => void
  onReject: (p: Payment) => void
  customerName: (id: number) => string
}

export function makeColumns(actions: Actions): ColumnDef<Payment, unknown>[] {
  return [
    {
      accessorKey: 'id',
      header: ({ column }) => <DataTableColumnHeader column={column} title='#' />,
      cell: ({ row }) => <span className='text-xs text-muted-foreground font-mono'>#{row.original.id}</span>,
    },
    {
      accessorKey: 'invoice_id',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Invoice' />,
      cell: ({ row }) => (
        <span className='font-mono text-sm'>#{row.original.invoice_id}</span>
      ),
    },
    {
      accessorKey: 'customer_id',
      id: 'customer',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Pelanggan' />,
      cell: ({ row }) => (
        <span className='text-sm'>{actions.customerName(row.original.customer_id)}</span>
      ),
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Jumlah' />,
      cell: ({ row }) => (
        <span className='font-semibold tabular-nums'>{formatIDR(row.original.amount)}</span>
      ),
    },
    {
      accessorKey: 'method',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Metode' />,
      cell: ({ row }) => (
        <span className='flex items-center gap-1.5 text-sm'>
          <MethodIcon method={row.original.method} />
          {methodLabel(row.original.method)}
        </span>
      ),
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
      cell: ({ row }) => <PaymentStatusBadge status={row.original.status} />,
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: 'created_at',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Tanggal' />,
      cell: ({ row }) => (
        <span className='text-sm text-muted-foreground'>{fmtDate(row.original.created_at)}</span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const p = row.original
        if (p.status !== 'pending') return null
        return (
          <div className='flex items-center justify-end gap-1'>
            <Button
              size='sm'
              variant='outline'
              className='h-7 gap-1 text-emerald-600 border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-xs'
              onClick={() => actions.onConfirm(p)}
            >
              <Check className='size-3' />
              Konfirmasi
            </Button>
            <Button
              size='sm'
              variant='outline'
              className='h-7 gap-1 text-destructive border-destructive/50 hover:bg-destructive/10 text-xs'
              onClick={() => actions.onReject(p)}
            >
              <X className='size-3' />
              Tolak
            </Button>
          </div>
        )
      },
    },
  ]
}
