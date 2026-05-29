import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

// Filter bar for the sales table. Stays controlled — parent debounces
// the search input before it hits the API hook so a fast typer doesn't
// burn a refetch per keystroke.
//
// `profile` and `server` option lists come from the parent (sourced from
// the current page's distinct values for now; will switch to a proper
// `/profiles` + `/servers` lookup once the Hotspot UI lands in Phase 7).

type SalesFiltersBarProps = {
  search: string
  onSearchChange: (next: string) => void
  profile: string
  onProfileChange: (next: string) => void
  server: string
  onServerChange: (next: string) => void
  profileOptions: string[]
  serverOptions: string[]
  onReset: () => void
  disabled?: boolean
}

export function SalesFiltersBar({
  search,
  onSearchChange,
  profile,
  onProfileChange,
  server,
  onServerChange,
  profileOptions,
  serverOptions,
  onReset,
  disabled,
}: SalesFiltersBarProps) {
  // "Has any filter active?" → drives the Reset button's visibility.
  // Keeps the bar visually quieter when there's nothing to reset.
  const hasFilters =
    search.length > 0 || profile !== 'all' || server !== 'all'

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <div className='relative min-w-[200px] flex-1 sm:flex-initial sm:basis-64'>
        <Search className='pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground' />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder='Search username, profile, MAC…'
          className='h-8 pl-8 text-xs'
          disabled={disabled}
        />
      </div>

      <Select
        value={profile}
        onValueChange={onProfileChange}
        disabled={disabled}
      >
        <SelectTrigger className='h-8 w-[140px] text-xs'>
          <SelectValue placeholder='Profile' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>All profiles</SelectItem>
          {profileOptions.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={server}
        onValueChange={onServerChange}
        disabled={disabled}
      >
        <SelectTrigger className='h-8 w-[120px] text-xs'>
          <SelectValue placeholder='Server' />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value='all'>All servers</SelectItem>
          {serverOptions.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant='ghost'
          size='sm'
          className='h-8 gap-1 text-xs text-muted-foreground'
          onClick={onReset}
          disabled={disabled}
        >
          <X className='size-3.5' />
          Reset
        </Button>
      )}
    </div>
  )
}
