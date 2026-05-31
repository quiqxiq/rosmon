import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { Check, Copy, QrCode } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { formatIDR } from '@/lib/format'
import { formatIDDate, formatPeriod, invoiceStatus } from '../_shared/format'
import { PortalHeader } from '../_shared/portal-header'
import { usePortalInvoice } from './api/queries'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='flex items-start justify-between gap-4 py-2'>
      <span className='text-sm text-muted-foreground'>{label}</span>
      <span className='text-right text-sm font-medium'>{value}</span>
    </div>
  )
}

export function InvoiceDetail() {
  const { id } = useParams({ strict: false })
  const invoiceId = Number(id)
  const { data: invoice, isLoading } = usePortalInvoice(invoiceId)
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    if (!invoice?.payment_code) return
    try {
      await navigator.clipboard.writeText(invoice.payment_code)
      setCopied(true)
      toast.success('Kode disalin!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Gagal menyalin kode')
    }
  }

  if (isLoading) {
    return (
      <div>
        <PortalHeader title='Detail Tagihan' showBack />
        <div className='space-y-3 p-4'>
          <Skeleton className='h-32 w-full rounded-xl' />
          <Skeleton className='h-56 w-full rounded-xl' />
        </div>
      </div>
    )
  }

  if (!invoice) {
    return (
      <div>
        <PortalHeader title='Detail Tagihan' showBack />
        <div className='flex flex-col items-center gap-2 py-16 text-center'>
          <QrCode className='size-10 text-muted-foreground/40' />
          <p className='font-medium'>Tagihan tidak ditemukan</p>
        </div>
      </div>
    )
  }

  const st = invoiceStatus(invoice.status)
  const isUnpaid = invoice.status === 'issued' || invoice.status === 'overdue'
  const formattedCode = invoice.payment_code
    ?.match(/.{1,4}/g)
    ?.join(' ') ?? ''

  return (
    <div>
      <PortalHeader title='Detail Tagihan' showBack />

      <div className='space-y-3 p-4'>
        {/* Invoice Summary */}
        <Card>
          <CardHeader className='pb-2 pt-4'>
            <div className='flex items-center justify-between'>
              <span className='font-mono text-sm text-muted-foreground'>
                {invoice.invoice_number}
              </span>
              <Badge variant={st.variant}>{st.label}</Badge>
            </div>
          </CardHeader>
          <CardContent className='space-y-0 pb-4'>
            <p className='text-3xl font-bold tabular-nums'>{formatIDR(invoice.amount)}</p>
            <Separator className='my-3' />
            <div className='divide-y'>
              <InfoRow
                label='Periode'
                value={formatPeriod(invoice.period_start, invoice.period_end)}
              />
              <InfoRow label='Jatuh Tempo' value={formatIDDate(invoice.due_date)} />
              {invoice.paid_at && (
                <InfoRow label='Tanggal Lunas' value={formatIDDate(invoice.paid_at)} />
              )}
              {invoice.notes && <InfoRow label='Catatan' value={invoice.notes} />}
            </div>
          </CardContent>
        </Card>

        {/* QR Code / Payment Code — only for unpaid invoices */}
        {isUnpaid && invoice.qr_content && invoice.payment_code ? (
          <Card className='border-primary/30'>
            <CardHeader className='pb-2 pt-4'>
              <CardTitle className='flex items-center gap-2 text-sm'>
                <QrCode className='size-4' />
                Kode Pembayaran
              </CardTitle>
            </CardHeader>
            <CardContent className='flex flex-col items-center gap-4 pb-5'>
              {/* QR Code */}
              <div className='rounded-2xl bg-white p-4 shadow-sm dark:bg-white'>
                <QRCodeSVG
                  value={invoice.qr_content}
                  size={200}
                  level='M'
                  includeMargin={false}
                />
              </div>

              {/* Code + Copy */}
              <div className='w-full space-y-2 text-center'>
                <p className='font-mono text-2xl font-bold tracking-widest'>
                  {formattedCode}
                </p>
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleCopy}
                  className='gap-1.5'
                >
                  {copied ? (
                    <>
                      <Check className='size-4 text-green-500' /> Tersalin!
                    </>
                  ) : (
                    <>
                      <Copy className='size-4' /> Salin Kode
                    </>
                  )}
                </Button>
              </div>

              <p className='text-center text-xs text-muted-foreground'>
                Tunjukkan QR atau sebutkan kode ini ke petugas saat membayar tunai.
                Pembayaran akan otomatis tercatat setelah petugas memindai.
              </p>
            </CardContent>
          </Card>
        ) : invoice.status === 'paid' ? (
          <Card className='border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30'>
            <CardContent className='flex items-center gap-3 p-4'>
              <span className='text-2xl'>✅</span>
              <div>
                <p className='font-medium text-green-700 dark:text-green-400'>
                  Tagihan Lunas
                </p>
                <p className='text-sm text-green-600 dark:text-green-500'>
                  Dibayar pada {formatIDDate(invoice.paid_at)}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
