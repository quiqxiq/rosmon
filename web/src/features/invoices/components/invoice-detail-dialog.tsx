import { useState } from 'react'
import { format } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { Copy, CreditCard, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { useInvoice, useCancelInvoice } from '../api/queries'
import { useInvoicePayments } from '@/features/payments/api/queries'
import { InvoiceStatusBadge } from './invoice-status-badge'
import { RecordPaymentDialog } from '@/features/payments/components/record-payment-dialog'
import { formatIDR } from '@/lib/format'
import { useCustomers } from '@/features/customers/api/queries'

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return format(new Date(s), 'd MMM yyyy', { locale: localeId })
}

function PaymentMethodBadge({ method }: { method: string }) {
  const labels: Record<string, string> = {
    cash: 'Tunai',
    manual_transfer: 'Transfer',
    xendit: 'Online',
  }
  return <Badge variant='secondary'>{labels[method] ?? method}</Badge>
}

type Props = {
  invoiceId: number | null
  onClose: () => void
}

export function InvoiceDetailDialog({ invoiceId, onClose }: Props) {
  const [showRecordPayment, setShowRecordPayment] = useState(false)
  const invoiceQuery = useInvoice(invoiceId ?? 0)
  const paymentsQuery = useInvoicePayments(invoiceId ?? 0)
  const customersQuery = useCustomers()
  const cancelMutation = useCancelInvoice()

  const inv = invoiceQuery.data
  const customer = customersQuery.data?.find(c => c.id === inv?.customer_id)
  const canCancel = inv && (inv.status === 'issued' || inv.status === 'draft')
  const canPay = inv && (inv.status === 'issued' || inv.status === 'overdue')

  function handleCancel() {
    if (!inv) return
    cancelMutation.mutate(inv.id, {
      onSuccess: () => {
        toast.success(`Invoice ${inv.invoice_number} dibatalkan`)
        onClose()
      },
      onError: (err) => toast.error('Gagal membatalkan invoice', { description: err.message }),
    })
  }

  function copyCode() {
    if (!inv?.payment_code) return
    navigator.clipboard.writeText(inv.payment_code)
    toast.success('Kode bayar disalin')
  }

  return (
    <>
      <Dialog open={invoiceId !== null} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className='sm:max-w-lg'>
          <DialogHeader>
            <DialogTitle>
              {invoiceQuery.isLoading ? 'Memuat...' : (inv?.invoice_number ?? 'Detail Invoice')}
            </DialogTitle>
          </DialogHeader>

          {invoiceQuery.isLoading ? (
            <div className='space-y-3'>
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className='h-5 w-full' />)}
            </div>
          ) : !inv ? (
            <p className='text-sm text-muted-foreground'>Invoice tidak ditemukan.</p>
          ) : (
            <div className='space-y-4'>
              {/* Status + jumlah */}
              <div className='flex items-center justify-between'>
                <InvoiceStatusBadge status={inv.status} />
                <span className='text-2xl font-bold'>{formatIDR(inv.amount)}</span>
              </div>

              {/* Info */}
              <dl className='grid grid-cols-2 gap-x-4 gap-y-2 text-sm'>
                <dt className='text-muted-foreground'>Pelanggan</dt>
                <dd className='font-medium'>{customer?.full_name ?? `#${inv.customer_id}`}</dd>

                <dt className='text-muted-foreground'>Periode</dt>
                <dd>{fmtDate(inv.period_start)} – {fmtDate(inv.period_end)}</dd>

                <dt className='text-muted-foreground'>Jatuh Tempo</dt>
                <dd className={inv.status === 'overdue' ? 'text-destructive font-medium' : ''}>
                  {fmtDate(inv.due_date)}
                </dd>

                {inv.paid_at && (
                  <>
                    <dt className='text-muted-foreground'>Dibayar</dt>
                    <dd className='text-emerald-600 font-medium'>{fmtDate(inv.paid_at)}</dd>
                  </>
                )}

                {inv.notes && (
                  <>
                    <dt className='text-muted-foreground'>Catatan</dt>
                    <dd>{inv.notes}</dd>
                  </>
                )}
              </dl>

              {/* Kode bayar */}
              {inv.payment_code && canPay && (
                <>
                  <Separator />
                  <div className='space-y-1.5'>
                    <p className='text-xs text-muted-foreground'>Kode Bayar (untuk kasir / QR)</p>
                    <div className='flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2'>
                      <code className='flex-1 font-mono text-sm font-semibold tracking-widest'>
                        {inv.payment_code}
                      </code>
                      <Button size='icon' variant='ghost' className='size-7' onClick={copyCode}>
                        <Copy className='size-3.5' />
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Riwayat payment */}
              {(paymentsQuery.data ?? []).length > 0 && (
                <>
                  <Separator />
                  <div className='space-y-2'>
                    <p className='text-xs font-medium text-muted-foreground uppercase'>Riwayat Pembayaran</p>
                    {(paymentsQuery.data ?? []).map(p => (
                      <div key={p.id} className='flex items-center justify-between text-sm'>
                        <div className='flex items-center gap-2'>
                          <PaymentMethodBadge method={p.method} />
                          <span className='text-muted-foreground'>
                            {p.confirmed_at ? fmtDate(p.confirmed_at) : fmtDate(p.created_at)}
                          </span>
                        </div>
                        <div className='flex items-center gap-2'>
                          <span className='font-medium'>{formatIDR(p.amount)}</span>
                          <Badge
                            variant={p.status === 'confirmed' ? 'default' : p.status === 'rejected' ? 'destructive' : 'secondary'}
                            className={p.status === 'confirmed' ? 'bg-emerald-600 hover:bg-emerald-600' : ''}
                          >
                            {p.status === 'confirmed' ? 'Dikonfirmasi' : p.status === 'rejected' ? 'Ditolak' : 'Pending'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Aksi */}
              <Separator />
              <div className='flex flex-wrap gap-2'>
                {canPay && (
                  <Button size='sm' className='gap-1.5' onClick={() => setShowRecordPayment(true)}>
                    <CreditCard className='size-4' />
                    Catat Pembayaran
                  </Button>
                )}
                {canCancel && (
                  <Button
                    size='sm'
                    variant='outline'
                    className='gap-1.5 text-destructive hover:text-destructive'
                    onClick={handleCancel}
                    disabled={cancelMutation.isPending}
                  >
                    <XCircle className='size-4' />
                    Batalkan Invoice
                  </Button>
                )}
                <Button size='sm' variant='outline' onClick={onClose}>
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {inv && showRecordPayment && (
        <RecordPaymentDialog
          open={showRecordPayment}
          onOpenChange={setShowRecordPayment}
          invoiceId={inv.id}
          customerId={inv.customer_id}
          defaultAmount={inv.amount}
          invoiceNumber={inv.invoice_number}
        />
      )}
    </>
  )
}
