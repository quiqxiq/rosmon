import { CalendarDays, Receipt, Wallet } from 'lucide-react'
import { formatIDR } from '@/lib/format'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// Counts/totals come straight from the backend `DailyReport` envelope;
// the parent passes them as scalars so this component stays decoupled
// from the API schema (and from the filter state used for the "of N"
// subtitle).
type DailySummaryCardsProps = {
  total: number
  count: number
  filteredCount: number
  filteredTotal: number
}

export function DailySummaryCards({
  total,
  count,
  filteredCount,
  filteredTotal,
}: DailySummaryCardsProps) {
  const avg = filteredCount > 0 ? Math.round(filteredTotal / filteredCount) : 0
  const isFiltered = filteredCount !== count

  const tiles = [
    {
      title: 'Sales Count',
      value: String(filteredCount),
      subtitle: isFiltered ? `of ${count} on date` : 'vouchers sold',
      icon: Receipt,
      iconClass: 'text-sky-600 dark:text-sky-400',
    },
    {
      title: 'Total Revenue',
      value: formatIDR(filteredTotal),
      subtitle: isFiltered
        ? `of ${formatIDR(total)} on date`
        : 'after selling price',
      icon: Wallet,
      iconClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Avg Per Voucher',
      value: formatIDR(avg),
      subtitle: 'across selection',
      icon: CalendarDays,
      iconClass: 'text-violet-600 dark:text-violet-400',
    },
  ]

  return (
    <div className='grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-3'>
      {tiles.map((tile) => {
        const Icon = tile.icon
        return (
          <Card key={tile.title}>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm'>
                {tile.title}
              </CardTitle>
              <Icon className={`size-5 ${tile.iconClass}`} />
            </CardHeader>
            <CardContent>
              <div className='font-mono text-xl font-bold tabular-nums sm:text-2xl'>
                {tile.value}
              </div>
              <p className='text-[11px] text-muted-foreground sm:text-xs'>
                {tile.subtitle}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
