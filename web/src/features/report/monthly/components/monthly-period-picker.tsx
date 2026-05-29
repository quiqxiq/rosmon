import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MONTH_NAMES } from '../../_shared/format'

type MonthlyPeriodPickerProps = {
  year: number
  month: number
  onChange: (year: number, month: number) => void
}

export function MonthlyPeriodPicker({
  year,
  month,
  onChange,
}: MonthlyPeriodPickerProps) {
  const today = new Date()
  const isCurrent = year === today.getFullYear() && month === today.getMonth()
  const minYear = today.getFullYear() - 5
  const years: number[] = []
  for (let y = today.getFullYear(); y >= minYear; y--) years.push(y)

  const shift = (delta: number) => {
    const next = new Date(year, month + delta, 1)
    onChange(next.getFullYear(), next.getMonth())
  }

  const isFuture = (() => {
    const start = new Date(year, month, 1)
    const currentStart = new Date(today.getFullYear(), today.getMonth(), 1)
    return start.getTime() >= currentStart.getTime()
  })()

  return (
    <div className='flex items-center gap-1'>
      <Button
        variant='outline'
        size='icon'
        className='size-8'
        onClick={() => shift(-1)}
      >
        <ChevronLeft className='size-4' />
      </Button>
      <Select
        value={String(month)}
        onValueChange={(v) => onChange(year, Number(v))}
      >
        <SelectTrigger className='h-8 w-[120px] text-xs'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTH_NAMES.map((name, i) => (
            <SelectItem key={name} value={String(i)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(year)}
        onValueChange={(v) => onChange(Number(v), month)}
      >
        <SelectTrigger className='h-8 w-[100px] text-xs'>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant='outline'
        size='icon'
        className='size-8'
        disabled={isFuture}
        onClick={() => shift(1)}
      >
        <ChevronRight className='size-4' />
      </Button>
      {!isCurrent && (
        <Button
          variant='ghost'
          size='sm'
          className='h-8 px-2 text-xs'
          onClick={() => onChange(today.getFullYear(), today.getMonth())}
        >
          This Month
        </Button>
      )}
    </div>
  )
}
