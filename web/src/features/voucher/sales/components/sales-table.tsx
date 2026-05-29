import { Eye, Loader2, Ticket } from 'lucide-react'
import { formatIDR } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { VoucherSale } from '../api/schema'

// Read-only table — the planned backend has no delete/edit/reorder
// endpoints, so the only row interaction is "open detail dialog".
//
// Loading state renders a centered spinner row INSIDE the table so the
// column widths stay stable as data streams in. Error state ditto with
// a retry button hook (caller-supplied).

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'short',
  timeStyle: 'short',
})

type SalesTableProps = {
  sales: VoucherSale[]
  loading: boolean
  error?: Error | null
  onRetry?: () => void
  onSelectSale: (sale: VoucherSale) => void
}

export function SalesTable({
  sales,
  loading,
  error,
  onRetry,
  onSelectSale,
}: SalesTableProps) {
  return (
    <div className='overflow-x-auto rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='whitespace-nowrap'>Sold At</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Profile</TableHead>
            <TableHead className='text-right whitespace-nowrap'>
              Price
            </TableHead>
            <TableHead>Server</TableHead>
            <TableHead className='hidden lg:table-cell'>IP</TableHead>
            <TableHead className='hidden lg:table-cell'>MAC</TableHead>
            <TableHead className='w-[60px] text-right'>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {error ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className='h-32 text-center text-destructive'
              >
                <p className='mb-2 text-sm'>
                  Failed to load sales
                  {error.message ? `: ${error.message}` : '.'}
                </p>
                {onRetry && (
                  <Button size='sm' variant='outline' onClick={onRetry}>
                    Retry
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ) : loading && sales.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className='h-32 text-center text-muted-foreground'
              >
                <Loader2 className='mx-auto mb-2 size-5 animate-spin' />
                Loading sales…
              </TableCell>
            </TableRow>
          ) : sales.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
                className='h-32 text-center text-muted-foreground'
              >
                <Ticket className='mx-auto mb-1 size-5 opacity-50' />
                No sales match the current filters.
              </TableCell>
            </TableRow>
          ) : (
            sales.map((sale) => (
              <TableRow
                key={sale.id}
                className='cursor-pointer'
                onClick={() => onSelectSale(sale)}
              >
                <TableCell className='font-mono text-xs whitespace-nowrap'>
                  {dateFormatter.format(new Date(sale.sold_at))}
                </TableCell>
                <TableCell className='font-mono text-sm font-semibold'>
                  {sale.username}
                </TableCell>
                <TableCell className='text-sm'>{sale.profile_name}</TableCell>
                <TableCell className='text-right font-mono text-sm tabular-nums text-emerald-600 dark:text-emerald-400'>
                  {formatIDR(sale.selling_price)}
                </TableCell>
                <TableCell className='font-mono text-xs'>
                  {sale.server}
                </TableCell>
                <TableCell className='hidden font-mono text-xs lg:table-cell'>
                  {sale.ip_address || '—'}
                </TableCell>
                <TableCell className='hidden font-mono text-xs lg:table-cell'>
                  {sale.mac_address || '—'}
                </TableCell>
                <TableCell className='text-right'>
                  {/* Stop propagation so the row's click handler doesn't
                      double-fire when the user clicks the dedicated
                      detail button. */}
                  <Button
                    variant='ghost'
                    size='icon'
                    className='size-7'
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectSale(sale)
                    }}
                  >
                    <Eye className='size-3.5' />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
