import { useState, useMemo } from 'react'
import { Check, ChevronDown, Phone, Search, Users, X } from 'lucide-react'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import type { WhatsAppContactItem } from '../api/schema'
import { parseToken, tokenLabel, tokenToString, type TargetToken } from '../api/schema'

// Fixed token options (tidak bergantung pada kontak).
const FIXED_OPTIONS: { token: TargetToken; label: string; icon: React.ReactNode }[] = [
  {
    token: { kind: 'wa_admin' },
    label: 'Admin WA (nomor admin)',
    icon: <Phone className='size-3.5' />,
  },
  {
    token: { kind: 'tg_admin' },
    label: 'Admin Telegram (chat ID)',
    icon: <span className='size-3.5 font-bold text-blue-500'>TG</span>,
  },
]

interface EventTargetPickerProps {
  value: string[]             // token strings yang sudah dipilih
  groups: WhatsAppContactItem[] // daftar grup dari WA
  connected: boolean          // apakah WA terkoneksi (untuk tampilkan grup)
  onChange: (tokens: string[]) => void
}

export function EventTargetPicker({ value, groups, connected, onChange }: EventTargetPickerProps) {
  const [open, setOpen] = useState(false)
  const [manualPhone, setManualPhone] = useState('')

  const tokens: TargetToken[] = useMemo(() => value.map(parseToken), [value])

  function toggleToken(t: TargetToken) {
    const str = tokenToString(t)
    if (value.includes(str)) {
      onChange(value.filter((v) => v !== str))
    } else {
      onChange([...value, str])
    }
  }

  function addManualPhone() {
    const phone = manualPhone.trim()
    if (!phone) return
    const token = tokenToString({ kind: 'wa_number', phone })
    if (!value.includes(token)) {
      onChange([...value, token])
    }
    setManualPhone('')
  }

  function removeToken(str: string) {
    onChange(value.filter((v) => v !== str))
  }

  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      {/* Chip-chip token yang sudah dipilih */}
      {tokens.map((t, i) => (
        <Badge
          key={i}
          variant='secondary'
          className='gap-1 pr-1 text-xs'
        >
          {tokenLabel(t, groups)}
          <button
            onClick={() => removeToken(tokenToString(t))}
            className='ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20'
          >
            <X className='size-2.5' />
          </button>
        </Badge>
      ))}

      {/* Tombol tambah target */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant='outline' size='sm' className='h-6 gap-1 px-2 text-xs'>
            Tambah
            <ChevronDown className='size-3' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-72 p-0' align='start'>
          <Command>
            <CommandInput placeholder='Cari target…' />
            <CommandList>
              <CommandEmpty>Tidak ditemukan.</CommandEmpty>
              {/* Opsi tetap: admin WA + admin TG */}
              <CommandGroup heading='Saluran'>
                {FIXED_OPTIONS.map(({ token, label, icon }) => {
                  const str = tokenToString(token)
                  const selected = value.includes(str)
                  return (
                    <CommandItem
                      key={str}
                      value={str}
                      onSelect={() => { toggleToken(token); setOpen(false) }}
                    >
                      <span className='mr-2 flex size-4 items-center justify-center'>{icon}</span>
                      {label}
                      {selected && <Check className='ml-auto size-3.5 text-primary' />}
                    </CommandItem>
                  )
                })}
              </CommandGroup>

              {/* Grup WhatsApp — hanya kalau connected */}
              {connected && groups.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading='Grup WhatsApp'>
                    {groups.map((g) => {
                      const str = tokenToString({ kind: 'wa_group', jid: g.jid })
                      const selected = value.includes(str)
                      return (
                        <CommandItem
                          key={g.jid}
                          value={`wa_group ${g.name}`}
                          onSelect={() => { toggleToken({ kind: 'wa_group', jid: g.jid }); setOpen(false) }}
                        >
                          <Users className='mr-2 size-3.5 text-muted-foreground' />
                          <span className='truncate'>{g.name}</span>
                          {selected && <Check className='ml-auto size-3.5 text-primary' />}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                </>
              )}

              {/* Nomor manual */}
              <CommandSeparator />
              <div className='p-2'>
                <p className='mb-1.5 text-[11px] font-medium text-muted-foreground'>
                  Nomor WA spesifik
                </p>
                <div className='flex gap-1'>
                  <Input
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder='6281234567890'
                    className='h-7 text-xs'
                    onKeyDown={(e) => e.key === 'Enter' && addManualPhone()}
                  />
                  <Button size='sm' className='h-7 px-2 text-xs' onClick={addManualPhone}>
                    +
                  </Button>
                </div>
              </div>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
