import { cn } from '@/lib/utils'
import { usePing, type PingStatus } from '@/hooks/use-ping'

const pillColors: Record<PingStatus, string> = {
  excellent:
    'text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-900 dark:bg-emerald-950/30',
  good: 'text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-400 dark:border-amber-900 dark:bg-amber-950/30',
  high: 'text-red-700 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-900 dark:bg-red-950/30',
  timeout: 'text-muted-foreground border-border bg-muted/50',
}

const dotColors: Record<PingStatus, string> = {
  excellent: 'bg-emerald-500',
  good: 'bg-amber-500',
  high: 'bg-red-500',
  timeout: 'bg-muted-foreground',
}

export function PingIndicator({ intervalMs }: { intervalMs?: number } = {}) {
  const { ms, status } = usePing(intervalMs)

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold font-mono transition-all',
        pillColors[status]
      )}
      aria-label={`Ping status: ${status}`}
    >
      <span className='relative flex h-2 w-2'>
        {status !== 'timeout' && (
          <span
            className={cn(
              'absolute inset-0 rounded-full animate-ping opacity-75',
              dotColors[status]
            )}
          />
        )}
        <span
          className={cn('relative h-2 w-2 rounded-full', dotColors[status])}
        />
      </span>
      <span className='min-w-[50px]'>
        {ms === null ? 'timeout' : `${ms} ms`}
      </span>
    </div>
  )
}
