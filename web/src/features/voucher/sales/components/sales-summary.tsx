import { Receipt, Wallet } from 'lucide-react'
import { formatIDR } from '@/lib/format'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// Two KPI cards driven by the server's filtered totals (the mock honors
// the same filtering semantics the real backend will use). Kept dumb on
// purpose — all logic lives in the parent so the cards always reflect
// whatever the API returned for the current query.
type SalesSummaryProps = {
  count: number
  revenue: number
  loading?: boolean
}

export function SalesSummary({ count, revenue, loading }: SalesSummaryProps) {
  const tiles = [
    {
      title: 'Total Sales',
      value: loading ? '…' : String(count),
      subtitle: count === 1 ? 'voucher in range' : 'vouchers in range',
      icon: Receipt,
      iconClass: 'text-sky-600 dark:text-sky-400',
    },
    {
      title: 'Total Revenue',
      value: loading ? '…' : formatIDR(revenue),
      subtitle: 'sum of selling prices',
      icon: Wallet,
      iconClass: 'text-emerald-600 dark:text-emerald-400',
    },
  ]

  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4'>
      {tiles.map((tile) => {
        const Icon = tile.icon
        return (
          <Card key={tile.title}>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-xs font-medium tracking-wide uppercase text-muted-foreground sm:text-sm'>
                {tile.title}
              </CardTitle>
              <Icon className={`size-5 ${tile.iconClass}`} />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold tabular-nums sm:text-3xl'>
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
