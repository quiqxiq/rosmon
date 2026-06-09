import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { formatBitsPerSecond } from '@/lib/format'
import { type LiveEntity } from '../data/schema'
import { Sparkline } from './sparkline'

type Props = {
  entity: LiveEntity
  onClick: () => void
}

export function TrafficCard({ entity, onClick }: Props) {
  const dotColor = entity.disabled
    ? 'bg-muted-foreground/40'
    : entity.running
      ? 'bg-emerald-500'
      : 'bg-amber-400'

  return (
    <button type='button' onClick={onClick} className='text-left'>
      <Card className='flex flex-col gap-2 p-3 transition-all hover:shadow-md hover:border-primary/40'>
        <div className='flex items-center justify-between gap-2'>
          <div className='flex items-center gap-2 min-w-0'>
            <span className={cn('size-2 shrink-0 rounded-full', dotColor)} />
            <span className='truncate font-mono text-sm font-semibold'>
              {entity.title}
            </span>
          </div>
          {entity.subtitle && (
            <span className='shrink-0 truncate text-xs text-muted-foreground'>
              {entity.subtitle}
            </span>
          )}
        </div>

        <div className='grid grid-cols-2 gap-2'>
          <div className='flex items-center gap-1.5'>
            <ArrowDown className='size-3.5 text-emerald-500' />
            <span className='font-mono text-sm tabular-nums'>
              {formatBitsPerSecond(Math.round(entity.rxBps))}
            </span>
          </div>
          <div className='flex items-center gap-1.5'>
            <ArrowUp className='size-3.5 text-indigo-500' />
            <span className='font-mono text-sm tabular-nums'>
              {formatBitsPerSecond(Math.round(entity.txBps))}
            </span>
          </div>
        </div>

        <Sparkline data={entity.spark} />

        {entity.maxLimit && (
          <div className='text-[10px] text-muted-foreground'>
            max-limit: <span className='font-mono'>{entity.maxLimit}</span>
          </div>
        )}
      </Card>
    </button>
  )
}
