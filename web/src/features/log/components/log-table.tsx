import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { topicColor } from '../data/data'
import { type LogEntry } from '../data/schema'

type LogTableProps = {
  entries: LogEntry[]
}

const timeFormatter = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
})

function formatLogTime(date: Date, now: Date = new Date()): string {
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  if (sameDay) return timeFormatter.format(date)
  return `${dateFormatter.format(date)} ${timeFormatter.format(date)}`
}

export function LogTable({ entries }: LogTableProps) {
  return (
    <div className='rounded-md border'>
      <div className='hidden grid-cols-[110px_140px_1fr] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground md:grid'>
        <span>Time</span>
        <span>Topics</span>
        <span>Message</span>
      </div>
      <ScrollArea className='h-[60vh]'>
        {entries.length === 0 ? (
          <div className='flex h-32 items-center justify-center text-sm text-muted-foreground'>
            No log entries match.
          </div>
        ) : (
          <ul className='divide-y'>
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={cn(
                  'grid grid-cols-1 gap-1 px-3 py-2 hover:bg-muted/40',
                  'md:grid-cols-[110px_140px_1fr] md:items-start md:gap-3'
                )}
              >
                <span className='font-mono text-[11px] text-muted-foreground md:text-xs'>
                  {formatLogTime(entry.time)}
                </span>
                <div className='flex flex-wrap gap-1'>
                  {entry.topics.map((t) => (
                    <Badge
                      key={t}
                      variant='outline'
                      className={cn(
                        'rounded px-1.5 py-0 font-mono text-[10px] font-normal',
                        topicColor(t)
                      )}
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
                <span className='break-words font-mono text-[12px] leading-relaxed'>
                  {entry.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  )
}
