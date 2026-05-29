import { formatIDR } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { VoucherSale } from '../api/schema'

// Read-only detail dialog — shows every field of a `VoucherSale` for
// support/debugging purposes. No edit/delete actions because the backend
// has no corresponding endpoints. Idempotency key + raw timestamps are
// surfaced so an admin can correlate with router logs.

type SalesDetailDialogProps = {
  sale: VoucherSale | null
  onClose: () => void
}

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'full',
  timeStyle: 'medium',
})

function fmtIso(value: string): string {
  // Some backend payloads omit timezone — Date constructor handles both
  // forms but we guard against `Invalid Date` strings just in case.
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? value : dateFormatter.format(d)
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='grid grid-cols-[120px_1fr] items-baseline gap-2'>
      <dt className='text-xs font-medium text-muted-foreground'>{label}</dt>
      <dd className='text-sm break-words'>{value}</dd>
    </div>
  )
}

export function SalesDetailDialog({ sale, onClose }: SalesDetailDialogProps) {
  // `open` derived from presence — keeps the component fully controlled
  // from the parent without a separate boolean.
  const open = sale != null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>Sale Detail</DialogTitle>
          <DialogDescription>
            Read-only record from the voucher sales log.
          </DialogDescription>
        </DialogHeader>

        {sale && (
          <dl className='space-y-2.5'>
            <Row label='ID' value={<span className='font-mono'>{sale.id}</span>} />
            <Row label='Sold At' value={fmtIso(sale.sold_at)} />
            <Row
              label='Username'
              value={<span className='font-mono font-semibold'>{sale.username}</span>}
            />
            <Row label='Profile' value={sale.profile_name || '—'} />
            <Row
              label='Selling Price'
              value={
                <span className='font-mono font-semibold text-emerald-600 dark:text-emerald-400'>
                  {formatIDR(sale.selling_price)}
                </span>
              }
            />
            {sale.price !== sale.selling_price && (
              <Row
                label='Base Price'
                value={<span className='font-mono'>{formatIDR(sale.price)}</span>}
              />
            )}
            <Row label='Validity' value={sale.validity || '—'} />
            <Row label='Server' value={<span className='font-mono'>{sale.server || '—'}</span>} />
            <Row
              label='IP'
              value={<span className='font-mono'>{sale.ip_address || '—'}</span>}
            />
            <Row
              label='MAC'
              value={<span className='font-mono'>{sale.mac_address || '—'}</span>}
            />
            <Row
              label='Created At'
              value={fmtIso(sale.created_at)}
            />
            <Row
              label='Idempotency'
              value={
                <span className='font-mono text-[11px] break-all text-muted-foreground'>
                  {sale.idempotency_key}
                </span>
              }
            />
          </dl>
        )}

        <DialogFooter>
          <Button variant='outline' onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
