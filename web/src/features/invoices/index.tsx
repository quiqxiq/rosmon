import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout/main'
import { SimpleDataTable } from '@/components/data-table'
import { useCustomers } from '@/features/customers/api/queries'
import { useInvoices } from './api/queries'
import { makeColumns } from './components/columns'
import { InvoiceDetailDialog } from './components/invoice-detail-dialog'
import { GenerateInvoiceDialog } from './components/generate-invoice-dialog'
import { RecordPaymentDialog } from '@/features/payments/components/record-payment-dialog'
import type { Invoice } from './api/schema'

export function Invoices() {
  const invoicesQuery = useInvoices()
  const customersQuery = useCustomers()

  const [detailId, setDetailId] = useState<number | null>(null)
  const [showGenerate, setShowGenerate] = useState(false)
  const [recordPaymentInvoice, setRecordPaymentInvoice] = useState<Invoice | null>(null)

  const customerName = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of customersQuery.data ?? []) map.set(c.id, c.full_name)
    return (id: number) => map.get(id) ?? `#${id}`
  }, [customersQuery.data])

  const columns = useMemo(
    () =>
      makeColumns({
        onDetail: (inv) => setDetailId(inv.id),
        onRecordPayment: (inv) => setRecordPaymentInvoice(inv),
        customerName,
      }),
    [customerName],
  )

  const data = invoicesQuery.data ?? []

  return (
    <>
      <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div className='space-y-1'>
            <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>Invoices</h2>
            <p className='text-sm text-muted-foreground sm:text-base'>
              {data.length} tagihan
            </p>
          </div>
          <Button size='sm' className='gap-1.5' onClick={() => setShowGenerate(true)}>
            <Plus className='size-4' />
            Buat Invoice
          </Button>
        </div>

        {invoicesQuery.isError ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive'>
            Gagal memuat invoice.
          </div>
        ) : (
          <SimpleDataTable
            columns={columns}
            data={data}
            searchKey='customer'
            searchPlaceholder='Cari nama pelanggan...'
            filters={[
              {
                columnId: 'status',
                title: 'Status',
                options: [
                  { label: 'Belum Bayar', value: 'issued' },
                  { label: 'Terlambat',   value: 'overdue' },
                  { label: 'Lunas',       value: 'paid' },
                  { label: 'Draft',       value: 'draft' },
                  { label: 'Dibatalkan',  value: 'cancelled' },
                ],
              },
            ]}
            emptyMessage='Belum ada invoice.'
          />
        )}
      </Main>

      <InvoiceDetailDialog
        invoiceId={detailId}
        onClose={() => setDetailId(null)}
      />

      <GenerateInvoiceDialog
        open={showGenerate}
        onOpenChange={setShowGenerate}
      />

      {recordPaymentInvoice && (
        <RecordPaymentDialog
          open={recordPaymentInvoice !== null}
          onOpenChange={(o) => !o && setRecordPaymentInvoice(null)}
          invoiceId={recordPaymentInvoice.id}
          customerId={recordPaymentInvoice.customer_id}
          defaultAmount={recordPaymentInvoice.amount}
          invoiceNumber={recordPaymentInvoice.invoice_number}
        />
      )}
    </>
  )
}
