import { AlertCircle, Calendar, User, Wifi } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { formatIDDate, subStatus } from '../_shared/format'
import { PortalHeader } from '../_shared/portal-header'
import { usePortalSubscriptions } from './api/queries'

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='flex items-start justify-between gap-4 py-2'>
      <span className='text-sm text-muted-foreground'>{label}</span>
      <span className='text-right text-sm font-medium'>{value}</span>
    </div>
  )
}

export function PortalSubscriptions() {
  const { data: subs = [], isLoading } = usePortalSubscriptions()

  return (
    <div>
      <PortalHeader title='Langganan' />

      <div className='space-y-3 p-4'>
        {isLoading ? (
          <>
            <Skeleton className='h-48 w-full rounded-xl' />
            <Skeleton className='h-32 w-full rounded-xl' />
          </>
        ) : subs.length === 0 ? (
          <div className='flex flex-col items-center gap-2 py-16 text-center'>
            <Wifi className='size-10 text-muted-foreground/40' />
            <p className='font-medium'>Tidak ada langganan</p>
            <p className='text-sm text-muted-foreground'>
              Hubungi admin untuk informasi lebih lanjut
            </p>
          </div>
        ) : (
          subs.map((sub) => {
            const st = subStatus(sub.status)
            return (
              <Card key={sub.id}>
                <CardHeader className='pb-2 pt-4'>
                  <div className='flex items-center justify-between'>
                    <CardTitle className='text-base'>
                      {sub.service_type === 'pppoe' ? 'PPPoE' : 'Hotspot'}
                    </CardTitle>
                    <Badge variant={st.variant}>{st.label}</Badge>
                  </div>
                </CardHeader>
                <CardContent className='pb-4'>
                  <div className='divide-y'>
                    <InfoRow
                      label='Username'
                      value={
                        <span className='font-mono'>{sub.mikrotik_username}</span>
                      }
                    />
                    <InfoRow
                      label='Tipe Koneksi'
                      value={sub.service_type === 'pppoe' ? 'PPPoE' : 'Hotspot'}
                    />
                    <InfoRow
                      label='Tagihan Berikutnya'
                      value={
                        sub.next_invoice_date
                          ? formatIDDate(sub.next_invoice_date)
                          : '—'
                      }
                    />
                    {sub.billing_day > 0 && (
                      <InfoRow label='Hari Tagih' value={`Tgl ${sub.billing_day}`} />
                    )}
                    {sub.activated_at && (
                      <InfoRow
                        label='Aktif Sejak'
                        value={formatIDDate(sub.activated_at)}
                      />
                    )}
                  </div>

                  {/* Sync status info */}
                  {sub.sync_status && sub.sync_status !== 'synced' && (
                    <>
                      <Separator className='my-3' />
                      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                        <AlertCircle className='size-3.5 shrink-0' />
                        <span>Perubahan sedang diproses ke jaringan…</span>
                      </div>
                    </>
                  )}

                  {/* Isolir warning */}
                  {(sub.status === 'isolir' || sub.status === 'suspended') && (
                    <>
                      <Separator className='my-3' />
                      <div className='rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'>
                        {sub.status === 'isolir'
                          ? 'Layanan diisolir karena tagihan belum dibayar. Segera lunasi tagihan agar layanan aktif kembali.'
                          : 'Layanan diblokir. Hubungi admin untuk informasi lebih lanjut.'}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}

        {/* Info banner */}
        <div className='flex items-start gap-2 rounded-xl border bg-muted/50 p-3 text-xs text-muted-foreground'>
          <div className='flex items-center gap-2'>
            <User className='size-3.5 shrink-0 mt-0.5' />
            <span>
              Untuk perubahan paket atau informasi lebih lanjut, hubungi admin Anda.
            </span>
          </div>
        </div>

        {subs.length > 0 && (
          <div className='flex items-start gap-2 rounded-xl border bg-muted/50 p-3 text-xs text-muted-foreground'>
            <Calendar className='size-3.5 shrink-0 mt-0.5' />
            <span>
              Tagihan dihasilkan otomatis setiap bulan sesuai tanggal tagih paket Anda.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
