import { CreditCard } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatIDR } from '@/lib/format'
import { formatIDDate, paymentMethod, paymentStatus } from '../_shared/format'
import { PortalHeader } from '../_shared/portal-header'
import { usePortalPayments } from './api/queries'

export function PaymentHistory() {
  const { data: payments = [], isLoading } = usePortalPayments()

  return (
    <div>
      <PortalHeader title='Riwayat Pembayaran' />

      <div className='space-y-2 p-4'>
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className='h-20 w-full rounded-xl' />
          ))
        ) : payments.length === 0 ? (
          <div className='flex flex-col items-center gap-2 py-16 text-center'>
            <CreditCard className='size-10 text-muted-foreground/40' />
            <p className='font-medium'>Belum ada pembayaran</p>
            <p className='text-sm text-muted-foreground'>
              Riwayat pembayaran Anda akan muncul di sini
            </p>
          </div>
        ) : (
          payments.map((pay) => {
            const st = paymentStatus(pay.status)
            return (
              <div
                key={pay.id}
                className='flex items-center gap-3 rounded-xl border bg-card p-4'
              >
                <div
                  className={`w-1 self-stretch rounded-full ${
                    pay.status === 'confirmed'
                      ? 'bg-emerald-500'
                      : pay.status === 'rejected'
                        ? 'bg-destructive'
                        : 'bg-amber-400'
                  }`}
                />
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center justify-between gap-2'>
                    <p className='text-sm font-bold tabular-nums'>
                      {formatIDR(pay.amount)}
                    </p>
                    <Badge variant={st.variant} className='text-xs'>
                      {st.label}
                    </Badge>
                  </div>
                  <p className='mt-0.5 text-xs text-muted-foreground'>
                    {paymentMethod(pay.method)}
                    {pay.confirmed_at && ` · ${formatIDDate(pay.confirmed_at)}`}
                  </p>
                  <p className='font-mono text-xs text-muted-foreground/70'>
                    Invoice #{pay.invoice_id}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
