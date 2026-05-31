import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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

const TYPES: Array<{ value: 'bypassed' | 'regular' | 'blocked'; label: string }> =
  [
    { value: 'bypassed', label: 'Bypassed' },
    { value: 'regular', label: 'Regular' },
    { value: 'blocked', label: 'Blocked' },
  ]

// ── Schema ──────────────────────────────────────────────────────────────────

const bindingSchema = z.object({
  mac: z.string(),
  address: z.string(),
  toAddress: z.string(),
  server: z.string(),
  type: z.enum(['bypassed', 'regular', 'blocked']),
  comment: z.string(),
})

const singleSchema = bindingSchema.extend({
  mac: z.string().min(1, 'MAC address wajib diisi'),
})

type BindingFormValues = z.infer<typeof bindingSchema>

// ── Helpers ──────────────────────────────────────────────────────────────────

// Strip empty values so we don't send `address=""` to RouterOS, which
// would clear the field on the device.
function compactPayload(input: Record<string, string>): IPBindingMutation {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(input)) {
    if (v !== '') out[k] = v
  }
  return out
}

// ── Root ─────────────────────────────────────────────────────────────────────

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

// ── Form ─────────────────────────────────────────────────────────────────────

type BindingFormProps = {
  mode: 'bind' | 'bind-many'
  target: HotspotHostViewModel | null
  ids: string[]
  bulk: Record<string, HotspotHostViewModel>
  onClose: () => void
}

function BindingForm({ mode, target, ids, bulk, onClose }: BindingFormProps) {
  const routerId = useActiveRouterId() ?? 0
  const addMutation = useAddIPBinding(routerId)
  const isBulk = mode === 'bind-many'

  const form = useForm<BindingFormValues>({
    resolver: zodResolver(isBulk ? bindingSchema : singleSchema),
    defaultValues: {
      mac: isBulk ? '' : (target?.macAddress ?? ''),
      address: isBulk ? '' : (target?.address ?? ''),
      toAddress: isBulk ? '' : (target?.toAddress ?? ''),
      server: isBulk ? '' : (target?.server ?? ''),
      type: 'bypassed',
      comment: isBulk ? '' : (target?.comment ?? ''),
    },
  })

  const isPending = addMutation.isPending

  const onSubmit = async (values: BindingFormValues) => {
    if (!isBulk) {
      const payload = compactPayload({
        'mac-address': values.mac.trim(),
        address: values.address.trim(),
        'to-address': values.toAddress.trim(),
        type: values.type,
        comment: values.comment,
        server: values.server,
      })
      try {
        await addMutation.mutateAsync(payload)
        toast.success(`IP binding created for ${values.mac}`)
        onClose()
      } catch (err) {
        toast.error('Failed to create binding', {
          description: err instanceof Error ? err.message : String(err),
        })
      }
      return
    }

    // Bulk: one binding per selected host. Type / Comment from the form
    // are applied to all; MAC / address / server come from each host.
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
            type: values.type,
            comment: values.comment,
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
      toast.error(`Failed to create ${failed} binding${failed > 1 ? 's' : ''}`)
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

      <Form {...form}>
        <form
          id='binding-form'
          className='flex flex-col gap-4 pt-2'
          onSubmit={form.handleSubmit(onSubmit)}
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
              {/* MAC Address */}
              <FormField
                control={form.control}
                name='mac'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MAC Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder='AA:BB:CC:DD:EE:FF'
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.value.toUpperCase())
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Address + To Address */}
              <div className='grid grid-cols-2 gap-3'>
                <FormField
                  control={form.control}
                  name='address'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input placeholder='192.168.10.10' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='toAddress'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>To Address</FormLabel>
                      <FormControl>
                        <Input placeholder='Optional' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Server */}
              <FormField
                control={form.control}
                name='server'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Server</FormLabel>
                    <FormControl>
                      <Input placeholder='Optional' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* Type */}
          <FormField
            control={form.control}
            name='type'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Comment */}
          <FormField
            control={form.control}
            name='comment'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Comment</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='Catatan opsional...'
                    className='resize-none'
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>

      <DialogFooter>
        <Button
          variant='outline'
          size='sm'
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type='submit'
          size='sm'
          form='binding-form'
          disabled={isPending}
          className='gap-1.5'
        >
          {isPending && <Loader2 className='size-4 animate-spin' />}
          Create Binding
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
