import * as React from 'react'
import { CheckIcon, ChevronsUpDownIcon, Loader2Icon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export type InputComboboxOption = {
  label: string
  value: string
}

type InputComboboxProps = {
  /** Pre-defined options shown in the dropdown (e.g. IP pool names, queue names, etc.). */
  options: InputComboboxOption[]
  /** Current value — can be any string, including one not in options. */
  value: string
  /** Called whenever the value changes (selection OR free-text). */
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /** Show a spinner and disable interactions while options are loading. */
  isLoading?: boolean
  /** Label shown as the dropdown group heading. Defaults to 'Pilihan'. */
  groupLabel?: string
  /** Text shown while loading. Defaults to 'Memuat...'. */
  loadingText?: string
  /** Text shown when no options match and the input is empty. */
  emptyText?: string
  className?: string
}

export function InputCombobox({
  options,
  value,
  onValueChange,
  placeholder = 'Ketik atau pilih...',
  disabled = false,
  isLoading = false,
  groupLabel = 'Pilihan',
  loadingText = 'Memuat...',
  emptyText,
  className,
}: InputComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Keep internal input in sync when the external value changes (e.g. form reset).
  React.useEffect(() => {
    setInputValue(value)
  }, [value])

  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return options
    const lower = inputValue.toLowerCase()
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(lower) ||
        o.value.toLowerCase().includes(lower),
    )
  }, [options, inputValue])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setInputValue(v)
    onValueChange(v)
    if (!open) setOpen(true)
  }

  const handleSelect = (selectedValue: string) => {
    setInputValue(selectedValue)
    onValueChange(selectedValue)
    setOpen(false)
    inputRef.current?.focus()
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setInputValue('')
    onValueChange('')
    setOpen(false)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      // Let Command handle arrow navigation — keep popover open.
      setOpen(true)
    }
  }

  const isSelected = (optionValue: string) => optionValue === value

  const resolvedEmptyText = emptyText
    ? emptyText
    : inputValue
      ? `Gunakan "${inputValue}" sebagai nilai custom`
      : 'Tidak ada pilihan tersedia'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* Wrapper div acts as the visible "input + button" control. */}
        <div
          className={cn(
            'flex h-9 w-full min-w-0 items-center rounded-md border border-input bg-transparent shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
            disabled && 'cursor-not-allowed opacity-50',
            className,
          )}
          onClick={(e) => e.preventDefault()}
        >
          <input
            ref={inputRef}
            type='text'
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setOpen(true)}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            autoComplete='off'
            className='h-full flex-1 min-w-0 bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed'
          />
          {inputValue && !disabled && !isLoading && (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='h-full w-7 shrink-0 px-1 text-muted-foreground hover:text-foreground'
              onClick={handleClear}
              tabIndex={-1}
              aria-label='Clear value'
            >
              <XIcon className='size-3.5' />
            </Button>
          )}
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='h-full w-8 shrink-0 rounded-l-none border-l border-input px-1.5 text-muted-foreground hover:text-foreground'
            disabled={disabled || isLoading}
            onClick={() => setOpen((prev) => !prev)}
            tabIndex={-1}
            aria-label='Toggle options'
          >
            {isLoading ? (
              <Loader2Icon className='size-3.5 animate-spin' />
            ) : (
              <ChevronsUpDownIcon className='size-3.5' />
            )}
          </Button>
        </div>
      </PopoverTrigger>

      <PopoverContent
        className='w-[--radix-popover-trigger-width] p-0'
        align='start'
        sideOffset={4}
        // Prevent focus from moving to popover — keep keyboard in input.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            {isLoading && (
              <div className='flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground'>
                <Loader2Icon className='size-3 animate-spin' />
                {loadingText}
              </div>
            )}
            {!isLoading && filteredOptions.length === 0 && (
              <CommandEmpty className='py-2 text-xs'>
                {resolvedEmptyText}
              </CommandEmpty>
            )}
            {!isLoading && filteredOptions.length > 0 && (
              <CommandGroup heading={groupLabel}>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={handleSelect}
                    className='text-sm'
                  >
                    <CheckIcon
                      className={cn(
                        'mr-2 size-3.5 shrink-0',
                        isSelected(option.value) ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {option.label}
                    {option.label !== option.value && (
                      <span className='ml-auto text-xs text-muted-foreground'>
                        {option.value}
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
