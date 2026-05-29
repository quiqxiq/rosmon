import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAddIPBinding } from '@/features/hotspot/bindings/api/queries'
import type { IPBindingMutation } from '@/features/hotspot/bindings/api/schema'
import { type HotspotHostViewModel } from '../components/view-model'
import { useHostsDialogStore } from '../store/hosts-dialog-store'

const TYPES: Array<{ value: 'bypassed' | 'regular' | 'blocked'; label: string }> = [
  { value: 'bypassed', label: 'Bypassed' },
  { value: 'regular', label: 'Regular' },
  { value: 'blocked', label: 'Blocked' },
]

type BindingDraft = {
  mac: string
  address: string
  toAddress: string
  comment: string
  type: 'bypassed' | 'regular' | 'blocked'
  server: string
}

const EMPTY_DRAFT: BindingDraft = {
  mac: '',
  address: '',
  toAddress: '',
  comment: '',
  type: 'bypassed',
  server: '',
}

export function MakeBindingDialog() {
  const { mode, target, ids, bulk, close } = useHostsDialogStore()
  const isOpen = mode === 'bind' || mode === 'bind-many'
  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && (
        <BindingForm
          key={target?.id ?? `bulk-${ids.length}`}
          mode={mode === 'bind-many' ? 'bind-many' : 'bind'}
          target={target}
          ids={ids}
          bulk={bulk}
          onClose={close}
        />
      )}
    </Dialog>
  )
}

type BindingFormProps = {
  mode: 'bind' | 'bind-many'
  target: HotspotHostViewModel | null
  ids: string[]
  bulk: Record<string, HotspotHostViewModel>
  onClose: () => void
}

// Strip empty values so we don't send `address=""` to RouterOS, which
// would clear the field on the device.
function compactPayload(input: Record<string, string>): IPBindingMutation {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v !== '') out[k] = v
  }
  return out
}

function BindingForm({ mode, target, ids, bulk, onClose }: BindingFormProps) {
  const routerId = useActiveRouterId() ?? 0
  const addMutation = useAddIPBinding(routerId)
  const isBulk = mode === 'bind-many'

  const [draft, setDraft] = useState<BindingDraft>(() => {
    if (!isBulk && target) {
      return {
        mac: target.macAddress,
        address: target.address,
        toAddress: target.toAddress,
        comment: target.comment,
        type: 'bypassed',
        server: target.server,
      }
    }
    return { ...EMPTY_DRAFT }
  })

  const update = <K extends keyof BindingDraft>(
    key: K,
    value: BindingDraft[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isBulk) {
      if (!draft.mac.trim()) {
        toast.error('MAC address is required')
        return
      }
      const payload = compactPayload({
        'mac-address': draft.mac.trim(),
        address: draft.address.trim(),
        'to-address': draft.toAddress.trim(),
        type: draft.type,
        comment: draft.comment,
        server: draft.server,
      })
      try {
        await addMutation.mutateAsync(payload)
        toast.success(`IP binding created for ${draft.mac}`)
        onClose()
      } catch (err) {
        toast.error('Failed to create binding', {
          description: err instanceof Error ? err.message : String(err),
        })
      }
      return
    }
    // Bulk: one binding per selected host. We use each host's own MAC /
    // address rather than the form's, so per-host fields stay correct.
    // The Type / Comment from the form are applied to all of them.
    const targets = ids
      .map((id) => bulk[id])
      .filter((h): h is HotspotHostViewModel => Boolean(h))
    if (targets.length === 0) {
      toast.error('No hosts selected')
      return
    }
    const results = await Promise.allSettled(
      targets.map((h) =>
        addMutation.mutateAsync(
          compactPayload({
            'mac-address': h.macAddress,
            address: h.address,
            'to-address': h.toAddress,
            type: draft.type,
            comment: draft.comment,
            server: h.server,
          }),
        ),
      ),
    )
    const failed = results.filter((r) => r.status === 'rejected').length
    const ok = results.length - failed
    if (failed === 0) {
      toast.success(`Created ${ok} IP binding${ok > 1 ? 's' : ''}`)
    } else if (ok === 0) {
      toast.error(
        `Failed to create ${failed} binding${failed > 1 ? 's' : ''}`,
      )
    } else {
      toast.warning(
        `Created ${ok}, failed ${failed} of ${results.length} bindings`,
      )
    }
    onClose()
  }

  const bulkSelection = isBulk
    ? ids.map((id) => bulk[id]).filter(Boolean)
    : []

  return (
    <DialogContent className='max-w-md'>
      <DialogHeader>
        <DialogTitle>
          {isBulk
            ? `Make IP Binding for ${ids.length} hosts`
            : 'Make IP Binding'}
        </DialogTitle>
        <DialogDescription>
          {isBulk
            ? 'A binding will be created for each selected host with the chosen type.'
            : 'Bind this host so it skips hotspot login.'}
        </DialogDescription>
      </DialogHeader>

      <form
        id='binding-form'
        className='flex flex-col gap-4 pt-2'
        onSubmit={handleSubmit}
      >
        {isBulk ? (
          <div className='rounded-md border bg-muted/40 p-3 text-xs'>
            <div className='mb-1 text-[11px] uppercase text-muted-foreground'>
              Selected hosts
            </div>
            <ul className='max-h-32 overflow-y-auto font-mono text-[11px]'>
              {bulkSelection.slice(0, 50).map((h) => (
                <li key={h.id}>
                  {h.macAddress} · {h.address}
                </li>
              ))}
              {bulkSelection.length > 50 && (
                <li className='text-muted-foreground'>
                  +{bulkSelection.length - 50} more…
                </li>
              )}
            </ul>
          </div>
        ) : (
          <>
            <Field label='MAC Address'>
              <Input
                value={draft.mac}
                onChange={(e) => update('mac', e.target.value.toUpperCase())}
                placeholder='AA:BB:CC:DD:EE:FF'
              />
            </Field>
            <div className='grid grid-cols-2 gap-3'>
              <Field label='Address'>
                <Input
                  value={draft.address}
                  onChange={(e) => update('address', e.target.value)}
                  placeholder='192.168.10.10'
                />
              </Field>
              <Field label='To Address'>
                <Input
                  value={draft.toAddress}
                  onChange={(e) => update('toAddress', e.target.value)}
                  placeholder='Optional'
                />
              </Field>
            </div>
            <Field label='Server'>
              <Input
                value={draft.server}
                onChange={(e) => update('server', e.target.value)}
                placeholder='Optional'
              />
            </Field>
          </>
        )}

        <Field label='Type'>
          <Select
            value={draft.type}
            onValueChange={(v) =>
              update('type', v as 'bypassed' | 'regular' | 'blocked')
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label='Comment'>
          <Input
            value={draft.comment}
            onChange={(e) => update('comment', e.target.value)}
            placeholder='Optional'
          />
        </Field>
      </form>

      <DialogFooter>
        <Button
          variant='outline'
          size='sm'
          onClick={onClose}
          disabled={addMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          type='submit'
          size='sm'
          form='binding-form'
          disabled={addMutation.isPending}
          className='gap-1.5'
        >
          {addMutation.isPending && (
            <Loader2 className='size-4 animate-spin' />
          )}
          Create Binding
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col gap-1.5'>
      <Label className='text-xs font-medium text-muted-foreground'>
        {label}
      </Label>
      {children}
    </div>
  )
}
