import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatIDR } from '@/lib/format'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { type MonthlyChartRow } from '../index'

type MonthlyDailyTableProps = {
  rows: MonthlyChartRow[]
  onSelectDay: (date: Date) => void
}

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})

export function MonthlyDailyTable({
  rows,
  onSelectDay,
}: MonthlyDailyTableProps) {
  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className='text-right'>Count</TableHead>
            <TableHead className='text-right'>Revenue</TableHead>
            <TableHead className='w-[40px]' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isEmpty = row.count === 0
            return (
              <TableRow
                key={row.date.toISOString()}
                onClick={() => !isEmpty && onSelectDay(row.date)}
                className={cn(
                  'group',
                  isEmpty
                    ? 'opacity-50'
                    : 'cursor-pointer hover:bg-muted/40'
                )}
              >
                <TableCell className='font-mono text-xs sm:text-sm'>
                  {dateFormatter.format(row.date)}
                </TableCell>
                <TableCell className='text-right font-mono tabular-nums'>
                  {row.count}
                </TableCell>
                <TableCell className='text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400'>
                  {row.total > 0 ? formatIDR(row.total) : '—'}
                </TableCell>
                <TableCell className='text-right'>
                  {!isEmpty && (
                    <ChevronRight className='ml-auto size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5' />
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
