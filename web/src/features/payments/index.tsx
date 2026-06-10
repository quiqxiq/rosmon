import { useMemo, useState } from 'react'
import { QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { SimpleDataTable } from '@/components/data-table'
import { useCustomers } from '@/features/customers/api/queries'
import { usePayments } from './api/queries'
import { makeColumns } from './components/columns'
import { ConfirmRejectDialog } from './components/confirm-reject-dialog'
import { CollectByCodeDialog } from './components/collect-by-code-dialog'
import type { Payment } from './api/schema'

export function Payments() {
  const paymentsQuery = usePayments()
  const customersQuery = useCustomers()

  const [confirmPayment, setConfirmPayment] = useState<Payment | null>(null)
  const [rejectPayment, setRejectPayment] = useState<Payment | null>(null)
  const [showCollect, setShowCollect] = useState(false)

  const customerName = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of customersQuery.data ?? []) map.set(c.id, c.full_name)
    return (id: number) => map.get(id) ?? `#${id}`
  }, [customersQuery.data])

  const columns = useMemo(
    () =>
      makeColumns({
        onConfirm: (p) => setConfirmPayment(p),
        onReject: (p) => setRejectPayment(p),
        customerName,
      }),
    [customerName],
  )

  const data = paymentsQuery.data ?? []
  const pendingCount = data.filter(p => p.status === 'pending').length

  return (
    <>
      <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div className='space-y-1'>
            <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>Pembayaran</h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              {data.length} transaksi
              {pendingCount > 0 && (
                <span className='ml-2 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600'>
                  {pendingCount} menunggu konfirmasi
                </span>
              )}
            </p>
          </div>
          <Button size='sm' variant='outline' className='gap-1.5' onClick={() => setShowCollect(true)}>
            <QrCode className='size-4' />
            Terima Pembayaran
          </Button>
        </div>

        {paymentsQuery.isError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Gagal memuat data pembayaran.
          </div>
        ) : (
          <SimpleDataTable
            columns={columns}
            data={data}
            filters={[
              {
                columnId: 'status',
                title: 'Status',
                options: [
                  { label: 'Pending',        value: 'pending' },
                  { label: 'Dikonfirmasi',   value: 'confirmed' },
                  { label: 'Ditolak',        value: 'rejected' },
                ],
              },
              {
                columnId: 'method',
                title: 'Metode',
                options: [
                  { label: 'Tunai',    value: 'cash' },
                  { label: 'Transfer', value: 'transfer' },
                  { label: 'Portal',   value: 'portal' },
                  { label: 'Online',   value: 'gateway' },
                ],
              },
            ]}
            emptyMessage='Belum ada transaksi pembayaran.'
          />
        )}
      </Main>

      <ConfirmRejectDialog
        payment={confirmPayment}
        mode='confirm'
        onClose={() => setConfirmPayment(null)}
      />
      <ConfirmRejectDialog
        payment={rejectPayment}
        mode='reject'
        onClose={() => setRejectPayment(null)}
      />
      <CollectByCodeDialog open={showCollect} onOpenChange={setShowCollect} />
    </>
  )
}
