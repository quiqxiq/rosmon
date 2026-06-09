import { Loader2 } from 'lucide-react'
import { type LiveEntity } from '../data/schema'
import type { SSEStatus } from '@/lib/api/sse'
import { TrafficCard } from './traffic-card'

type Props = {
  entities: LiveEntity[]
  status: SSEStatus
  emptyHint: string
  onSelect: (entity: LiveEntity) => void
}

export function StatsGrid({ entities, status, emptyHint, onSelect }: Props) {
  if (entities.length === 0) {
    return (
      <div className='flex h-48 flex-col items-center justify-center gap-2 rounded-md border text-sm text-muted-foreground'>
        {status === 'connecting' || status === 'open' ? (
          <>
            <Loader2 className='size-5 animate-spin' />
            Menunggu data…
          </>
        ) : (
          emptyHint
        )}
      </div>
    )
  }

  const sorted = [...entities].sort((a, b) => a.title.localeCompare(b.title))

  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
      {sorted.map((e) => (
        <TrafficCard key={e.key} entity={e} onClick={() => onSelect(e)} />
      ))}
    </div>
  )
}
