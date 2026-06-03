import { type ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTableColumnHeader } from '@/components/data-table'
import { formatIDR } from '@/lib/format'
import type { Invoice } from '../api/schema'
import { InvoiceStatusBadge } from './invoice-status-badge'

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return format(new Date(s), 'd MMM yy', { locale: localeId })
}

type Actions = {
  onDetail: (inv: Invoice) => void
  onRecordPayment: (inv: Invoice) => void
  customerName: (id: number) => string
}

export function makeColumns(actions: Actions): ColumnDef<Invoice, unknown>[] {
  return [
    {
      accessorKey: 'invoice_number',
      header: ({ column }) => <DataTableColumnHeader column={column} title='No. Invoice' />,
      cell: ({ row }) => (
        <button
          className='font-mono text-sm font-medium text-primary hover:underline'
          onClick={() => actions.onDetail(row.original)}
        >
          {row.original.invoice_number}
        </button>
      ),
    },
    {
      accessorKey: 'customer_id',
      id: 'customer',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Pelanggan' />,
      cell: ({ row }) => (
        <span className='text-sm'>{actions.customerName(row.original.customer_id)}</span>
      ),
      filterFn: (row, _id, filterValue: string) => {
        const name = actions.customerName(row.original.customer_id).toLowerCase()
        return name.includes(filterValue.toLowerCase())
      },
    },
    {
      accessorKey: 'amount',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Jumlah' />,
      cell: ({ row }) => (
        <span className='font-semibold tabular-nums'>{formatIDR(row.original.amount)}</span>
      ),
    },
    {
      accessorKey: 'period_start',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Periode' />,
      cell: ({ row }) => (
        <span className='text-sm text-muted-foreground'>{fmtDate(row.original.period_start)}</span>
      ),
    },
    {
      accessorKey: 'due_date',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Jatuh Tempo' />,
      cell: ({ row }) => {
        const inv = row.original
        const isOverdue = inv.status === 'overdue'
        return (
          <span className={`text-sm ${isOverdue ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
            {fmtDate(inv.due_date)}
          </span>
        )
      },
    },
    {
      accessorKey: 'status',
      header: ({ column }) => <DataTableColumnHeader column={column} title='Status' />,
      cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} />,
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const inv = row.original
        const canPay = inv.status === 'issued' || inv.status === 'overdue'
        return (
          <div className='flex justify-end'>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='ghost' size='icon' className='size-8'>
                  <MoreHorizontal className='size-4' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end'>
                <DropdownMenuItem onClick={() => actions.onDetail(inv)}>
                  Lihat Detail
                </DropdownMenuItem>
                {canPay && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => actions.onRecordPayment(inv)}>
                      Catat Pembayaran
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      },
    },
  ]
}
