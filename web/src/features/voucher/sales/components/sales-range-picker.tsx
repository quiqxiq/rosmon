import { format } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

// Date range picker for the sales page. Reuses the project's existing
// `Calendar` primitive with react-day-picker's built-in `range` mode
// instead of pulling in the heavier `date-range-picker.tsx` (which
// currently has unresolved issues — see Phase 5 follow-ups).
//
// The component is fully controlled — parent owns the dates, this only
// renders the popover and surfaces user picks. Both endpoints are
// inclusive (matches the backend's `from`/`to` semantics).

type SalesRangePickerProps = {
  from: Date
  to: Date
  onChange: (from: Date, to: Date) => void
  disabled?: boolean
}

function fmtRange(from: Date, to: Date): string {
  // Same-day → compact label; different days → "MMM d, yyyy → MMM d, yyyy".
  if (
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth() &&
    from.getDate() === to.getDate()
  ) {
    return format(from, 'MMM d, yyyy')
  }
  return `${format(from, 'MMM d, yyyy')} → ${format(to, 'MMM d, yyyy')}`
}

export function SalesRangePicker({
  from,
  to,
  onChange,
  disabled,
}: SalesRangePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='h-8 min-w-[220px] justify-start gap-1.5 text-xs font-normal'
          disabled={disabled}
        >
          <CalendarIcon className='size-3.5 opacity-60' />
          {fmtRange(from, to)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0' align='start'>
        <Calendar
          mode='range'
          numberOfMonths={2}
          selected={{ from, to }}
          defaultMonth={from}
          // `disabled` arg here would block users from picking future
          // sales — which is exactly what we want; you can't have sold
          // a voucher tomorrow.
          disabled={(date) =>
            date > new Date() || date < new Date('2020-01-01')
          }
          onSelect={(range) => {
            // react-day-picker calls back with `{ from?, to? }` where
            // both can be undefined mid-selection. Only commit once
            // the user has picked both endpoints — until then the
            // parent keeps its previous range.
            if (range?.from && range?.to) {
              onChange(range.from, range.to)
            }
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
