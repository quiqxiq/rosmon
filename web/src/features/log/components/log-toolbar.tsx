import { Check, Filter, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { LOG_TOPICS } from '../data/schema'

type LogToolbarProps = {
  search: string
  onSearchChange: (value: string) => void
  selectedTopics: string[]
  onTopicsChange: (next: string[]) => void
  totalShown: number
  totalAll: number
}

export function LogToolbar({
  search,
  onSearchChange,
  selectedTopics,
  onTopicsChange,
  totalShown,
  totalAll,
}: LogToolbarProps) {
  const selectedSet = new Set(selectedTopics)

  const toggle = (topic: string) => {
    if (selectedSet.has(topic)) {
      onTopicsChange(selectedTopics.filter((t) => t !== topic))
    } else {
      onTopicsChange([...selectedTopics, topic])
    }
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <div className='relative max-w-sm flex-1 min-w-[200px]'>
        <Search className='absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground' />
        <Input
          placeholder='Search logs...'
          className='h-8 pl-8'
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            size='sm'
            className='h-8 gap-1.5 border-dashed'
          >
            <Filter className='size-3.5' />
            Topics
            {selectedTopics.length > 0 && (
              <>
                <span className='mx-1 h-4 w-px bg-border' />
                <Badge variant='secondary' className='rounded-sm px-1 font-normal'>
                  {selectedTopics.length}
                </Badge>
              </>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-[220px] p-0' align='start'>
          <Command>
            <CommandInput placeholder='Filter topics...' />
            <CommandList>
              <CommandEmpty>No topics.</CommandEmpty>
              <CommandGroup>
                {LOG_TOPICS.map((topic) => {
                  const checked = selectedSet.has(topic)
                  return (
                    <CommandItem
                      key={topic}
                      onSelect={() => toggle(topic)}
                      className='cursor-pointer'
                    >
                      <div
                        className={cn(
                          'mr-2 flex size-4 items-center justify-center rounded-sm border',
                          checked
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input opacity-50'
                        )}
                      >
                        {checked && <Check className='size-3' />}
                      </div>
                      <span className='font-mono text-xs'>{topic}</span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
              {selectedTopics.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => onTopicsChange([])}
                      className='justify-center text-center text-xs'
                    >
                      Clear filters
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {(search || selectedTopics.length > 0) && (
        <Button
          variant='ghost'
          size='sm'
          className='h-8 gap-1.5'
          onClick={() => {
            onSearchChange('')
            onTopicsChange([])
          }}
        >
          <X className='size-3.5' />
          Reset
        </Button>
      )}
      <span className='ml-auto text-xs text-muted-foreground'>
        Showing <span className='font-mono'>{totalShown}</span> of{' '}
        <span className='font-mono'>{totalAll}</span>
      </span>
    </div>
  )
}
