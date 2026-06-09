import { Link } from '@tanstack/react-router'
import { ChevronRight, CreditCard, Wifi } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatIDR } from '@/lib/format'
import { formatIDDate, invoiceStatus, subStatus } from '../_shared/format'
import { usePortalInvoices } from '../invoices/api/queries'
import { usePortalSubscriptions } from '../subscriptions/api/queries'
import { usePortalMe } from './api/queries'

export function PortalHome() {
  const { data: me, isLoading: meLoading } = usePortalMe()
  const { data: subs = [], isLoading: subLoading } = usePortalSubscriptions()
  const { data: unpaidInvoices = [], isLoading: invLoading } = usePortalInvoices({ status: 'issued' })
  const { data: overdueInvoices = [] } = usePortalInvoices({ status: 'overdue' })

  const allUnpaid = [...overdueInvoices, ...unpaidInvoices]
  const activeSub = subs[0]
  const topInvoice = allUnpaid[0]

  return (
    <div className='flex flex-col'>
      {/* Header */}
      <header className='bg-background px-4 pb-3 pt-6'>
        {meLoading ? (
          <Skeleton className='h-6 w-40' />
        ) : (
          <div className='flex items-center justify-between'>
            <div>
              <p className='text-sm text-muted-foreground'>Halo,</p>
              <h1 className='text-lg font-semibold leading-tight'>{me?.full_name ?? '—'}</h1>
            </div>
            {me?.status && (
              <Badge variant='online' className='text-xs'>
                {me.status === 'active' ? 'Aktif' : me.status}
              </Badge>
            )}
          </div>
        )}
      </header>

      <div className='space-y-3 px-4 pb-6'>
        {/* Service Status Card */}
        <Card>
          <CardContent className='flex items-center gap-3 p-4'>
            <div className='flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10'>
              <Wifi className='size-5 text-primary' />
            </div>
            <div className='min-w-0 flex-1'>
              <p className='text-xs text-muted-foreground'>Status Layanan</p>
              {subLoading ? (
                <Skeleton className='mt-1 h-5 w-24' />
              ) : activeSub ? (
                <div className='flex items-center gap-2'>
                  <span className='text-sm font-medium'>
                    {activeSub.mikrotik_username || '—'}
                  </span>
                  <Badge variant={subStatus(activeSub.status).variant} className='text-xs'>
                    {subStatus(activeSub.status).label}
                  </Badge>
                </div>
              ) : (
                <span className='text-sm text-muted-foreground'>Tidak ada langganan</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Outstanding Invoice Hero Card */}
        {invLoading ? (
          <Skeleton className='h-28 w-full rounded-xl' />
        ) : topInvoice ? (
          <Card className='border-destructive/30 bg-destructive/5'>
            <CardContent className='p-4'>
              <div className='mb-3 flex items-center justify-between'>
                <div className='flex items-center gap-2'>
                  <CreditCard className='size-4 text-destructive' />
                  <span className='text-sm font-medium text-destructive'>
                    {allUnpaid.length > 1
                      ? `${allUnpaid.length} Tagihan Belum Lunas`
                      : 'Tagihan Belum Lunas'}
                  </span>
                </div>
                <Badge variant={invoiceStatus(topInvoice.status).variant} className='text-xs'>
                  {invoiceStatus(topInvoice.status).label}
                </Badge>
              </div>
              <p className='text-2xl font-bold tabular-nums'>
                {formatIDR(topInvoice.amount)}
              </p>
              <p className='mt-0.5 text-xs text-muted-foreground'>
                Jatuh tempo: {formatIDDate(topInvoice.due_date)}
              </p>
              <Button asChild className='mt-3 w-full' size='sm'>
                <Link to='/portal/invoices'>
                  Lihat &amp; Tunjukkan Kode Bayar
                  <ChevronRight className='size-4' />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className='border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'>
            <CardContent className='flex items-center gap-3 p-4'>
              <span className='text-xl'>🎉</span>
              <div>
                <p className='text-sm font-medium text-green-700 dark:text-green-400'>
                  Tidak ada tagihan
                </p>
                <p className='text-xs text-green-600 dark:text-green-500'>
                  Semua tagihan Anda sudah lunas
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Subscription Summary */}
        {activeSub && (
          <Card>
            <CardContent className='p-4'>
              <div className='mb-2 flex items-center justify-between'>
                <p className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
                  Paket Aktif
                </p>
                <Link
                  to='/portal/subscriptions'
                  className='flex items-center text-xs text-primary'
                >
                  Detail <ChevronRight className='size-3' />
                </Link>
              </div>
              <div className='space-y-1'>
                <p className='text-sm font-semibold'>
                  {activeSub.service_type === 'pppoe' ? 'PPPoE' : 'Hotspot'}
                  {' · '}
                  <span className='font-mono'>{activeSub.mikrotik_username}</span>
                </p>
                {activeSub.next_invoice_date && (
                  <p className='text-xs text-muted-foreground'>
                    Tagihan berikutnya: {formatIDDate(activeSub.next_invoice_date)}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Links */}
        <div className='grid grid-cols-2 gap-3'>
          <Link
            to='/portal/invoices'
            className='flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center text-sm font-medium transition-colors hover:bg-accent'
          >
            <CreditCard className='size-6 text-primary' />
            <span>Tagihan</span>
            {allUnpaid.length > 0 && (
              <span className='text-xs text-destructive'>
                {allUnpaid.length} belum lunas
              </span>
            )}
          </Link>
          <Link
            to='/portal/payments'
            className='flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center text-sm font-medium transition-colors hover:bg-accent'
          >
            <CreditCard className='size-6 text-primary' />
            <span>Riwayat Bayar</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
