import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { parseAPIError } from '@/lib/api/errors'
import type { NotifEventConfig, WhatsAppContactItem } from '../api/schema'
import { useNotifEvents, useUpdateNotifEvent } from '../api/queries'
import { EventTargetPicker } from './event-target-picker'
import { Button } from '@/components/ui/button'

interface EventRoutingTableProps {
  groups: WhatsAppContactItem[]
  waConnected: boolean
}

export function EventRoutingTable({ groups, waConnected }: EventRoutingTableProps) {
  const query = useNotifEvents()
  const updateMut = useUpdateNotifEvent()

  // Local state untuk target yang sedang diedit (belum disimpan).
  const [drafts, setDrafts] = useState<Record<string, string[]>>({})
  const [saving, setSaving] = useState<string | null>(null)

  function getTargets(cfg: NotifEventConfig): string[] {
    return drafts[cfg.event] ?? cfg.targets
  }

  function setTargets(event: string, targets: string[]) {
    setDrafts((prev) => ({ ...prev, [event]: targets }))
  }

  function isDirty(cfg: NotifEventConfig) {
    const d = drafts[cfg.event]
    if (!d) return false
    return JSON.stringify(d.sort()) !== JSON.stringify([...cfg.targets].sort())
  }

  async function save(event: string) {
    const targets = drafts[event] ?? []
    setSaving(event)
    updateMut.mutate(
      { event, payload: { targets } },
      {
        onSuccess: () => {
          toast.success('Konfigurasi disimpan')
          setDrafts((prev) => { const n = { ...prev }; delete n[event]; return n })
        },
        onError: (err) => toast.error('Gagal menyimpan', { description: parseAPIError(err) }),
        onSettled: () => setSaving(null),
      },
    )
  }

  if (query.isLoading) {
    return (
      <div className='flex h-32 items-center justify-center'>
        <Loader2 className='size-5 animate-spin text-muted-foreground' />
      </div>
    )
  }

  const events = query.data ?? []

  return (
    <div className='overflow-hidden rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className='w-44'>Event</TableHead>
            <TableHead>Target Penerima</TableHead>
            <TableHead className='w-20 text-right'>Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((cfg) => (
            <TableRow key={cfg.event}>
              <TableCell>
                <div>
                  <p className='text-sm font-medium'>{cfg.label}</p>
                  <p className='text-xs text-muted-foreground'>{cfg.description}</p>
                </div>
              </TableCell>
              <TableCell>
                <EventTargetPicker
                  value={getTargets(cfg)}
                  groups={groups}
                  connected={waConnected}
                  onChange={(t) => setTargets(cfg.event, t)}
                />
              </TableCell>
              <TableCell className='text-right'>
                {isDirty(cfg) && (
                  <Button
                    size='sm'
                    variant='default'
                    className='h-7 gap-1 px-2 text-xs'
                    disabled={saving === cfg.event}
                    onClick={() => save(cfg.event)}
                  >
                    {saving === cfg.event ? (
                      <Loader2 className='size-3 animate-spin' />
                    ) : (
                      <Save className='size-3' />
                    )}
                    Simpan
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
