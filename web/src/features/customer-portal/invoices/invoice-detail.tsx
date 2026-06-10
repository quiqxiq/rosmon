import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { 
  Check, 
  Copy, 
  CreditCard, 
  ExternalLink, 
  Loader2, 
  QrCode, 
  UploadCloud, 
  FileText, 
  Trash2, 
  CheckCircle2, 
  XCircle
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api/query-keys'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatIDR } from '@/lib/format'
import { formatIDDate, formatPeriod, invoiceStatus } from '../_shared/format'
import { PortalHeader } from '../_shared/portal-header'
import { 
  useInitiateOnlinePayment, 
  usePortalInvoice, 
  usePaymentGatewayStatus, 
  useUploadProof, 
  useCreatePortalPayment 
} from './api/queries'
import { usePortalPayments } from '@/features/customer-portal/payments/api/queries'

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
  const queryClient = useQueryClient()
  
  const { data: invoice, isLoading: isInvoiceLoading } = usePortalInvoice(invoiceId)
  const { data: gatewayStatus, isLoading: isGatewayLoading } = usePaymentGatewayStatus()
  const { data: payments, isLoading: isPaymentsLoading } = usePortalPayments()
  
  const [copied, setCopied] = useState(false)
  const [bankName, setBankName] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const { mutate: initiatePayment, isPending: isInitiating } = useInitiateOnlinePayment()
  const { mutate: uploadProofMutate, isPending: isUploading } = useUploadProof()
  const { mutate: createPortalPaymentMutate, isPending: isSubmitting } = useCreatePortalPayment()

  const invoicePayments = (payments ?? []).filter(p => p.invoice_id === invoiceId)
  const pendingPayment = invoicePayments.find(p => p.status === 'pending')
  const rejectedPayment = invoicePayments.find(p => p.status === 'rejected')

  const isUnpaid = invoice?.status === 'issued' || invoice?.status === 'overdue'
  const gatewayEnabled = gatewayStatus?.enabled ?? false

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

  function handlePayOnline() {
    initiatePayment(invoiceId, {
      onSuccess: (result) => {
        toast.success('Mengarahkan ke halaman pembayaran...')
        window.open(result.invoice_url, '_blank', 'noopener,noreferrer')
      },
      onError: (err: unknown) => {
        const msg =
          err instanceof Error ? err.message : 'Gagal membuat link pembayaran. Coba lagi.'
        if (msg.includes('503') || msg.includes('SERVICE_UNAVAILABLE')) {
          toast.error('Pembayaran online belum tersedia. Silakan bayar via kasir atau transfer.')
        } else if (msg.includes('CONFLICT') || msg.includes('lunas')) {
          toast.info('Tagihan ini sudah lunas.')
        } else {
          toast.error(msg)
        }
      },
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleClearFile = () => {
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
  }

  const handleUploadAndSubmit = () => {
    if (!selectedFile || !bankName.trim()) {
      toast.error('Nama bank dan file bukti transfer wajib diisi')
      return
    }

    uploadProofMutate(selectedFile, {
      onSuccess: (uploadRes) => {
        createPortalPaymentMutate(
          {
            invoiceId,
            input: {
              proof_url: uploadRes.url,
              bank_name: bankName,
              reference_number: referenceNumber,
            },
          },
          {
            onSuccess: () => {
              toast.success('Bukti pembayaran berhasil dikirim untuk verifikasi admin')
              queryClient.invalidateQueries({ queryKey: qk.portalInvoice(invoiceId) })
              queryClient.invalidateQueries({ queryKey: qk.portalInvoices() })
              queryClient.invalidateQueries({ queryKey: qk.portalPayments() })
              setBankName('')
              setReferenceNumber('')
              setSelectedFile(null)
              setPreviewUrl(null)
            },
            onError: (err: any) => {
              toast.error('Gagal mengirim data pembayaran: ' + (err.message || err))
            },
          },
        )
      },
      onError: (err: any) => {
        toast.error('Gagal mengunggah file bukti transfer: ' + (err.message || err))
      },
    })
  }

  if (isInvoiceLoading || isPaymentsLoading) {
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

        {/* Render Payment Actions / Pending / Rejection / Gateway */}
        {invoice.status === 'paid' ? (
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
        ) : pendingPayment ? (
          /* Pembayaran Pending */
          <Card className='border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20'>
            <CardContent className='flex flex-col gap-4 p-5'>
              <div className='flex items-start gap-3'>
                <div className='rounded-full bg-amber-500/10 p-2 text-amber-600 dark:text-amber-400 flex-shrink-0'>
                  <Loader2 className='size-5 animate-spin' />
                </div>
                <div className='space-y-1'>
                  <p className='font-semibold text-amber-800 dark:text-amber-400'>
                    Menunggu Konfirmasi
                  </p>
                  <p className='text-xs text-amber-700/80 dark:text-amber-500/80 leading-relaxed'>
                    Bukti transfer Anda telah terkirim dan sedang diverifikasi oleh admin. 
                    Layanan internet akan diaktifkan secara otomatis setelah pembayaran disetujui.
                  </p>
                </div>
              </div>
              <Separator className='bg-amber-200/50 dark:bg-amber-900/50' />
              <div className='grid grid-cols-2 gap-y-2 text-xs text-amber-900/80 dark:text-amber-400/80 font-medium'>
                <div>Bank Pengirim</div>
                <div className='text-right'>{pendingPayment.bank_name || '—'}</div>
                <div>No. Referensi</div>
                <div className='text-right'>{pendingPayment.reference_number || '—'}</div>
                <div>Jumlah</div>
                <div className='text-right font-bold'>{formatIDR(pendingPayment.amount)}</div>
              </div>
              {pendingPayment.proof_url && (
                <div className='mt-1 rounded-lg border overflow-hidden max-h-48 bg-white flex items-center justify-center p-2'>
                  <img 
                    src={`${(import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/+$/, '')}${pendingPayment.proof_url}`} 
                    alt="Bukti Transfer" 
                    className="max-h-44 object-contain rounded"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        ) : isUnpaid ? (
          <>
            {/* Alert Pembayaran Sebelumnya Ditolak */}
            {rejectedPayment && (
              <Card className='border-destructive/30 bg-destructive/5 mb-1'>
                <CardContent className='flex items-start gap-3 p-4'>
                  <div className='rounded-full bg-destructive/15 p-1.5 text-destructive flex-shrink-0'>
                    <XCircle className='size-5' />
                  </div>
                  <div className='space-y-1'>
                    <p className='font-semibold text-destructive text-sm'>
                      Pembayaran Sebelumnya Ditolak
                    </p>
                    <p className='text-xs text-muted-foreground leading-relaxed'>
                      Alasan: <strong className="text-foreground">{rejectedPayment.rejection_reason || 'Bukti transfer tidak valid/jelas'}</strong>
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      Silakan unggah ulang bukti transfer baru yang benar di bawah ini.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {isGatewayLoading ? (
              <div className='space-y-3'>
                <Skeleton className='h-48 w-full rounded-xl' />
              </div>
            ) : gatewayEnabled ? (
              /* Online Gateway Xendit */
              <Card className='border-primary/40 bg-primary/5'>
                <CardContent className='flex flex-col gap-3 p-4'>
                  <div className='flex items-center gap-2'>
                    <CreditCard className='size-5 text-primary' />
                    <p className='font-semibold text-primary'>Bayar Online</p>
                  </div>
                  <p className='text-xs text-muted-foreground leading-relaxed'>
                    Bayar tagihan ini secara instan menggunakan transfer virtual account (VA), QRIS, e-wallet,
                    atau minimarket. Pembayaran akan terkonfirmasi dan layanan aktif otomatis.
                  </p>
                  <Button
                    id='btn-pay-online'
                    className='w-full gap-2 font-semibold'
                    onClick={handlePayOnline}
                    disabled={isInitiating}
                  >
                    {isInitiating ? (
                      <>
                        <Loader2 className='size-4 animate-spin' />
                        Menyiapkan pembayaran...
                      </>
                    ) : (
                      <>
                        <ExternalLink className='size-4' />
                        Bayar Sekarang
                      </>
                    )}
                  </Button>
                  <p className='text-center text-xs text-muted-foreground'>
                    Anda akan diarahkan ke halaman pembayaran Xendit yang aman
                  </p>
                </CardContent>
              </Card>
            ) : (
              /* Form Manual Proof Upload */
              <div className="space-y-4 rounded-xl border border-muted bg-card p-5 shadow-sm">
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm">Transfer Bank Manual</h3>
                  <p className="text-xs text-muted-foreground">
                    Silakan transfer sebesar <strong className="text-foreground">{formatIDR(invoice.amount)}</strong> ke salah satu rekening berikut:
                  </p>
                </div>
                <div className="rounded-lg bg-muted/50 p-3.5 space-y-1 text-xs border">
                  <p className="font-semibold">Bank Mandiri</p>
                  <p className="text-muted-foreground">No. Rekening: <strong className="font-mono text-xs text-foreground">131-00-1234567-8</strong></p>
                  <p className="text-muted-foreground">Atas Nama: <strong className="text-foreground">PT Antigravity ISP Indonesia</strong></p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="bank-name" className="text-xs">Nama Bank / Dompet Pengirim <span className="text-destructive">*</span></Label>
                    <Input
                      id="bank-name"
                      placeholder="BCA, Mandiri, BRI, GoPay, OVO, dll."
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="ref-number" className="text-xs">Nomor Referensi / ID Transaksi</Label>
                    <Input
                      id="ref-number"
                      placeholder="1234567890 (opsional)"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Bukti Transfer <span className="text-destructive">*</span></Label>
                    {!previewUrl ? (
                      <label
                        htmlFor="proof-file"
                        className="flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 hover:bg-primary/5 p-5 text-center cursor-pointer transition-all duration-200"
                      >
                        <UploadCloud className="size-7 text-muted-foreground/60" />
                        <div className="space-y-0.5">
                          <p className="text-xs font-medium">Klik untuk pilih berkas</p>
                          <p className="text-[10px] text-muted-foreground">PNG, JPG, JPEG atau PDF (maks. 5MB)</p>
                        </div>
                        <input
                          id="proof-file"
                          type="file"
                          accept="image/*,.pdf"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                      </label>
                    ) : (
                      <div className="relative rounded-lg border bg-muted/20 p-2.5 flex items-center gap-3">
                        {selectedFile?.type.startsWith('image/') ? (
                          <div className="size-11 rounded-md border bg-white overflow-hidden flex-shrink-0 flex items-center justify-center">
                            <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="size-11 rounded-md border bg-white flex-shrink-0 flex items-center justify-center text-muted-foreground">
                            <FileText className="size-5" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{selectedFile?.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {selectedFile ? (selectedFile.size / 1024 / 1024).toFixed(2) + ' MB' : ''}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={handleClearFile}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive size-7"
                        >
                          <Trash2 className="size-4.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleUploadAndSubmit}
                  disabled={isUploading || isSubmitting || !bankName.trim() || !selectedFile}
                  className="w-full h-9 text-xs font-semibold gap-1.5 mt-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Mengunggah file...
                    </>
                  ) : isSubmitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Mengirim data...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="size-3.5" />
                      Kirim Bukti Pembayaran
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* QR Code / Payment Code — only for unpaid invoices */}
            {invoice.qr_content && invoice.payment_code && (
              <Card className='border-primary/30 mt-3'>
                <CardHeader className='pb-2 pt-4'>
                  <CardTitle className='flex items-center gap-2 text-sm'>
                    <QrCode className='size-4' />
                    Bayar via Kasir (Tunai)
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

                  <p className='text-center text-xs text-muted-foreground leading-relaxed'>
                    Tunjukkan QR atau sebutkan kode ini ke petugas saat membayar tunai.
                    Pembayaran akan otomatis tercatat setelah petugas memindai.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
