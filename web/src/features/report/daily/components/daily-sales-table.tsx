import { Search } from 'lucide-react'
import type { VoucherSale } from '@/features/voucher/sales/api/schema'
import { cn } from '@/lib/utils'
import { formatIDR } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

type DailySalesTableFilters = {
  search: string
  profile: string
  server: string
}

type DailySalesTableProps = {
  sales: VoucherSale[]
  filteredSales: VoucherSale[]
  filters: DailySalesTableFilters
  onFiltersChange: (next: DailySalesTableFilters) => void
}

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

export function DailySalesTable({
  sales,
  filteredSales,
  filters,
  onFiltersChange,
}: DailySalesTableProps) {
  // Profile/server option lists are derived from the unfiltered set so
  // they stay stable as the user narrows the filter — picking "all" then
  // "profile X" must always show every profile that exists for the day.
  const profiles = Array.from(new Set(sales.map((s) => s.profile_name))).sort()
  const servers = Array.from(new Set(sales.map((s) => s.server))).sort()

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative max-w-sm flex-1 min-w-[200px]'>
          <Search className='absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search username, MAC, IP...'
            className='h-8 pl-8'
            value={filters.search}
            onChange={(e) =>
              onFiltersChange({ ...filters, search: e.target.value })
            }
          />
        </div>
        <Select
          value={filters.profile}
          onValueChange={(v) => onFiltersChange({ ...filters, profile: v })}
        >
          <SelectTrigger className='h-8 w-[150px] text-xs'>
            <SelectValue placeholder='Profile' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All profiles</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.server}
          onValueChange={(v) => onFiltersChange({ ...filters, server: v })}
        >
          <SelectTrigger className='h-8 w-[120px] text-xs'>
            <SelectValue placeholder='Server' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All servers</SelectItem>
            {servers.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filters.search ||
          filters.profile !== 'all' ||
          filters.server !== 'all') && (
          <Button
            variant='ghost'
            size='sm'
            className='h-8 px-2 text-xs'
            onClick={() =>
              onFiltersChange({ search: '', profile: 'all', server: 'all' })
            }
          >
            Reset
          </Button>
        )}
      </div>

      <div className='rounded-md border'>
        <div className='hidden md:block'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className='w-[100px]'>Time</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Profile</TableHead>
                <TableHead className='text-right'>Price</TableHead>
                <TableHead>Validity</TableHead>
                <TableHead>Server</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>MAC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className='h-24 text-center text-muted-foreground'
                  >
                    No sales for the current filter.
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className='font-mono text-xs'>
                      {timeFormatter.format(new Date(sale.sold_at))}
                    </TableCell>
                    <TableCell className='font-mono text-sm font-semibold'>
                      {sale.username}
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline' className='font-mono text-[10px]'>
                        {sale.profile_name}
                      </Badge>
                    </TableCell>
                    <TableCell className='text-right font-mono text-sm tabular-nums text-emerald-600 dark:text-emerald-400'>
                      {formatIDR(sale.selling_price)}
                    </TableCell>
                    <TableCell className='font-mono text-xs'>
                      {sale.validity}
                    </TableCell>
                    <TableCell className='font-mono text-xs'>
                      {sale.server}
                    </TableCell>
                    <TableCell className='font-mono text-xs'>
                      {sale.ip_address}
                    </TableCell>
                    <TableCell className='font-mono text-[11px]'>
                      {sale.mac_address}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className='flex flex-col divide-y md:hidden'>
          {filteredSales.length === 0 ? (
            <div className='flex h-24 items-center justify-center text-sm text-muted-foreground'>
              No sales for the current filter.
            </div>
          ) : (
            filteredSales.map((sale) => (
              <div key={sale.id} className='flex flex-col gap-1.5 px-3 py-3'>
                <div className='flex items-start justify-between gap-2'>
                  <span className='font-mono text-sm font-semibold'>
                    {sale.username}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-sm tabular-nums text-emerald-600 dark:text-emerald-400',
                    )}
                  >
                    {formatIDR(sale.selling_price)}
                  </span>
                </div>
                <div className='flex items-center justify-between gap-2 text-[11px] text-muted-foreground'>
                  <span className='font-mono'>
                    {timeFormatter.format(new Date(sale.sold_at))} ·{' '}
                    {sale.server}
                  </span>
                  <span className='font-mono'>{sale.profile_name}</span>
                </div>
                <div className='flex items-center justify-between gap-2 text-[11px]'>
                  <span className='font-mono text-muted-foreground'>
                    {sale.ip_address} · {sale.mac_address}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
