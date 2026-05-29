import { Award, Receipt, Wallet } from 'lucide-react'
import { formatIDR } from '@/lib/format'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// "Best Day" is computed in the parent (the backend doesn't expose it),
// so this component takes the resolved date + total directly. Keeps the
// summary card free of any business logic.
type MonthlySummaryCardsProps = {
  count: number
  total: number
  bestDate: Date | null
  bestTotal: number
}

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})

export function MonthlySummaryCards({
  count,
  total,
  bestDate,
  bestTotal,
}: MonthlySummaryCardsProps) {
  const tiles = [
    {
      title: 'Total Sales',
      value: String(count),
      subtitle: 'vouchers sold this month',
      icon: Receipt,
      iconClass: 'text-sky-600 dark:text-sky-400',
    },
    {
      title: 'Total Revenue',
      value: formatIDR(total),
      subtitle: 'after selling price',
      icon: Wallet,
      iconClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Best Day',
      value: bestDate ? dateFormatter.format(bestDate) : '—',
      subtitle: bestDate ? formatIDR(bestTotal) : 'no sales',
      icon: Award,
      iconClass: 'text-amber-600 dark:text-amber-400',
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
