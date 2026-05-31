import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronRight, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatIDR } from '@/lib/format'
import { formatIDDate, formatPeriod, invoiceStatus } from '../_shared/format'
import type { PortalInvoice } from '../_shared/types'
import { PortalHeader } from '../_shared/portal-header'
import { usePortalInvoices } from './api/queries'

const FILTERS: { label: string; value: string }[] = [
  { label: 'Semua', value: 'all' },
  { label: 'Belum Bayar', value: 'issued' },
  { label: 'Terlambat', value: 'overdue' },
  { label: 'Lunas', value: 'paid' },
]

function InvoiceCard({ invoice }: { invoice: PortalInvoice }) {
  const st = invoiceStatus(invoice.status)
  return (
    <Link
      to='/portal/invoices/$id'
      params={{ id: String(invoice.id) }}
      className='flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-accent active:scale-[0.98]'
    >
      <div className='flex size-9 shrink-0 items-center justify-center rounded-full bg-muted'>
        <FileText className='size-4 text-muted-foreground' />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2'>
          <span className='truncate font-mono text-xs text-muted-foreground'>
            {invoice.invoice_number}
          </span>
          <Badge variant={st.variant} className='shrink-0 text-xs'>
            {st.label}
          </Badge>
        </div>
        <p className='mt-0.5 text-sm text-muted-foreground'>
          {formatPeriod(invoice.period_start, invoice.period_end)}
        </p>
        <p
          className={`mt-0.5 text-base font-bold tabular-nums ${
            invoice.status === 'paid' ? 'line-through opacity-50' : ''
          }`}
        >
          {formatIDR(invoice.amount)}
        </p>
        <p className='text-xs text-muted-foreground'>
          {invoice.status === 'paid'
            ? `Lunas ${formatIDDate(invoice.paid_at)}`
            : `Jatuh tempo ${formatIDDate(invoice.due_date)}`}
        </p>
      </div>
      <ChevronRight className='size-4 shrink-0 text-muted-foreground' />
    </Link>
  )
}

export function InvoiceList() {
  const [activeFilter, setActiveFilter] = useState<string>('all')

  const { data: allInvoices = [], isLoading } = usePortalInvoices()
  const { data: issuedInvoices = [] } = usePortalInvoices({ status: 'issued' })
  const { data: overdueInvoices = [] } = usePortalInvoices({ status: 'overdue' })
  const { data: paidInvoices = [] } = usePortalInvoices({ status: 'paid' })

  const dataMap: Record<string, PortalInvoice[]> = {
    all: allInvoices,
    issued: issuedInvoices,
    overdue: overdueInvoices,
    paid: paidInvoices,
  }
  const displayed = dataMap[activeFilter] ?? allInvoices

  const unpaidCount = issuedInvoices.length + overdueInvoices.length

  return (
    <div>
      <PortalHeader title='Tagihan' />

      {/* Filter chips */}
      <div className='flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide'>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveFilter(f.value)}
            className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
              activeFilter === f.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground hover:bg-accent'
            }`}
          >
            {f.label}
            {f.value === 'all' && unpaidCount > 0 && (
              <span className='ml-1.5 rounded-full bg-destructive px-1.5 py-0.5 text-xs text-white'>
                {unpaidCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className='space-y-2 px-4 pb-4'>
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className='h-24 w-full rounded-xl' />
          ))
        ) : displayed.length === 0 ? (
          <div className='flex flex-col items-center gap-2 py-16 text-center'>
            <FileText className='size-10 text-muted-foreground/40' />
            <p className='font-medium'>Tidak ada tagihan</p>
            <p className='text-sm text-muted-foreground'>
              {activeFilter === 'paid' ? 'Belum ada pembayaran' : 'Semua tagihan sudah lunas 🎉'}
            </p>
          </div>
        ) : (
          displayed.map((inv) => <InvoiceCard key={inv.id} invoice={inv} />)
        )}
      </div>
    </div>
  )
}
