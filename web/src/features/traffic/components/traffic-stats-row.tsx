import { ArrowDown, ArrowUp, TrendingDown, TrendingUp } from 'lucide-react'
import { formatBitsPerSecond } from '@/lib/format'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { type TrafficSample } from '../data/schema'

type TrafficStatsRowProps = {
  current: TrafficSample | null
  samples: TrafficSample[]
}

type StatTile = {
  label: string
  value: string
  icon: React.ElementType
  iconClass: string
}

export function TrafficStatsRow({ current, samples }: TrafficStatsRowProps) {
  const peakRx = samples.reduce((m, s) => Math.max(m, s.rxBps), 0)
  const peakTx = samples.reduce((m, s) => Math.max(m, s.txBps), 0)

  const tiles: StatTile[] = [
    {
      label: 'RX',
      value: formatBitsPerSecond(current?.rxBps ?? 0),
      icon: ArrowDown,
      iconClass: 'text-sky-600 dark:text-sky-400',
    },
    {
      label: 'TX',
      value: formatBitsPerSecond(current?.txBps ?? 0),
      icon: ArrowUp,
      iconClass: 'text-violet-600 dark:text-violet-400',
    },
    {
      label: 'Peak RX',
      value: formatBitsPerSecond(peakRx),
      icon: TrendingDown,
      iconClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Peak TX',
      value: formatBitsPerSecond(peakTx),
      icon: TrendingUp,
      iconClass: 'text-amber-600 dark:text-amber-400',
    },
  ]

  return (
    <div className='grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4'>
      {tiles.map((tile) => {
        const Icon = tile.icon
        return (
          <Card key={tile.label}>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-xs font-medium uppercase tracking-wide text-muted-foreground sm:text-sm'>
                {tile.label}
              </CardTitle>
              <Icon className={`size-5 ${tile.iconClass}`} />
            </CardHeader>
            <CardContent>
              <div className='font-mono text-xl font-bold tabular-nums sm:text-2xl'>
                {tile.value}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
