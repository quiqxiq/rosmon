import { CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

type DailyDatePickerProps = {
  date: Date
  onChange: (date: Date) => void
}

const fullDateFormatter = new Intl.DateTimeFormat('id-ID', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function shiftDay(date: Date, delta: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + delta)
  return next
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function DailyDatePicker({ date, onChange }: DailyDatePickerProps) {
  const today = startOfDay(new Date())
  const isToday = startOfDay(date).getTime() === today.getTime()
  const isFuture = startOfDay(date).getTime() >= today.getTime()

  return (
    <div className='flex items-center gap-1'>
      <Button
        variant='outline'
        size='icon'
        className='size-8'
        onClick={() => onChange(shiftDay(date, -1))}
      >
        <ChevronLeft className='size-4' />
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            size='sm'
            className={cn('h-8 gap-1.5 px-2.5', isToday && 'border-primary/40')}
          >
            <CalendarIcon className='size-3.5' />
            <span className='font-mono text-xs sm:text-sm'>
              {fullDateFormatter.format(date)}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-auto p-0' align='start'>
          <Calendar
            mode='single'
            selected={date}
            onSelect={(d) => d && onChange(d)}
            disabled={(d) => d > today}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      <Button
        variant='outline'
        size='icon'
        className='size-8'
        disabled={isFuture}
        onClick={() => onChange(shiftDay(date, 1))}
      >
        <ChevronRight className='size-4' />
      </Button>
      {!isToday && (
        <Button
          variant='ghost'
          size='sm'
          className='h-8 px-2 text-xs'
          onClick={() => onChange(today)}
        >
          Today
        </Button>
      )}
    </div>
  )
}
