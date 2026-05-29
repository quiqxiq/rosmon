import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { type NetInterface } from '../data/schema'

type InterfaceSelectProps = {
  interfaces: NetInterface[]
  value: string
  onChange: (name: string) => void
}

export function InterfaceSelect({
  interfaces,
  value,
  onChange,
}: InterfaceSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className='w-[220px]'>
        <SelectValue placeholder='Select interface' />
      </SelectTrigger>
      <SelectContent>
        {interfaces.map((iface) => (
          <SelectItem key={iface.id} value={iface.name}>
            <span className='flex w-full items-center gap-2'>
              <span
                className={cn(
                  'inline-block size-2 shrink-0 rounded-full',
                  iface.disabled
                    ? 'bg-muted-foreground/40'
                    : iface.running
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                )}
              />
              <span className='font-mono text-sm'>{iface.name}</span>
              <span className='ml-auto text-[10px] uppercase text-muted-foreground'>
                {iface.type}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
