import { Activity, History } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { type TrafficMode } from '../data/schema'

type TrafficModeToggleProps = {
  mode: TrafficMode
  onChange: (mode: TrafficMode) => void
}

export function TrafficModeToggle({ mode, onChange }: TrafficModeToggleProps) {
  return (
    <div className='inline-flex rounded-md border bg-background p-0.5'>
      <Button
        type='button'
        size='sm'
        variant='ghost'
        className={cn(
          'h-7 gap-1.5 px-2.5 text-xs',
          mode === 'live' && 'bg-muted text-foreground'
        )}
        onClick={() => onChange('live')}
      >
        <Activity className='size-3.5' />
        Live
      </Button>
      <Button
        type='button'
        size='sm'
        variant='ghost'
        className={cn(
          'h-7 gap-1.5 px-2.5 text-xs',
          mode === 'history' && 'bg-muted text-foreground'
        )}
        onClick={() => onChange('history')}
      >
        <History className='size-3.5' />
        History
      </Button>
    </div>
  )
}
