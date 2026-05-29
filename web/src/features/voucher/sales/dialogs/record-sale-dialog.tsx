import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRecordSale } from '@/features/voucher/sales/api/queries'
import type { RecordSaleParams } from '@/features/voucher/sales/api/schema'
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
import { useSalesDialogStore } from '../store/sales-dialog-store'

// Manual sale entry. Backend's RecordSaleParams treats every field as
// optional EXCEPT username, and the server applies an idempotency
// hash so resubmits are safe. We surface only the most common fields:
// username/profile/server/price/sold_at — power users can sync the rest
// via Import.

type FormState = {
  username: string
  profile_name: string
  server: string
  price: string // kept as string in the input; coerced on submit
  // `sold_at` uses <input type="datetime-local">'s native format
  // (YYYY-MM-DDTHH:mm). Empty string → omit, backend defaults to now.
  sold_at: string
}

const EMPTY: FormState = {
  username: '',
  profile_name: '',
  server: '',
  price: '',
  sold_at: '',
}

// Convert `datetime-local` string → ISO. The input value has no TZ
// info, so treat it as local time; `new Date(value)` does exactly that
// for "YYYY-MM-DDTHH:mm". Returns `undefined` if the user left it blank.
function localToIso(value: string): string | undefined {
  if (!value) return undefined
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

export function RecordSaleDialog() {
  const routerId = useActiveRouterId()
  const { kind, close } = useSalesDialogStore()
  const open = kind === 'record'

  const [form, setForm] = useState<FormState>(EMPTY)
  // `useRecordSale` requires routerId at hook creation time. When no
  // router is selected the page already shows a gate, but we still
  // guard the mutation call below so an edge-case re-render can't fire
  // a `/routers/0/...` request.
  const mutation = useRecordSale(routerId ?? 0)

  const handleClose = () => {
    setForm(EMPTY)
    close()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (routerId == null) {
      toast.error('Select a router first')
      return
    }
    const username = form.username.trim()
    if (!username) {
      toast.error('Username is required')
      return
    }

    const params: RecordSaleParams = {
      username,
      profile_name: form.profile_name.trim() || undefined,
      server: form.server.trim() || undefined,
      // Parsed lazily — invalid numbers fall through as `undefined` so
      // the server isn't sent garbage like NaN.
      price:
        form.price.trim().length > 0 && !Number.isNaN(Number(form.price))
          ? Number(form.price)
          : undefined,
      sold_at: localToIso(form.sold_at),
    }

    mutation.mutate(params, {
      onSuccess: () => {
        toast.success('Sale recorded', { description: username })
        handleClose()
      },
      onError: (err) => {
        toast.error('Failed to record sale', { description: err.message })
      },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !mutation.isPending) handleClose()
      }}
    >
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>Record Sale</DialogTitle>
          <DialogDescription>
            Manually log a voucher sale. Only username is required —
            other fields default to whatever RouterOS provides.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className='space-y-3'>
          <div className='space-y-1.5'>
            <Label htmlFor='record-username'>Username *</Label>
            <Input
              id='record-username'
              autoFocus
              value={form.username}
              onChange={(e) =>
                setForm((f) => ({ ...f, username: e.target.value }))
              }
              placeholder='vc-abc123'
              autoComplete='off'
              required
            />
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label htmlFor='record-profile'>Profile</Label>
              <Input
                id='record-profile'
                value={form.profile_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, profile_name: e.target.value }))
                }
                placeholder='voucher-1d'
                autoComplete='off'
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='record-server'>Server</Label>
              <Input
                id='record-server'
                value={form.server}
                onChange={(e) =>
                  setForm((f) => ({ ...f, server: e.target.value }))
                }
                placeholder='hotspot1'
                autoComplete='off'
              />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div className='space-y-1.5'>
              <Label htmlFor='record-price'>Price (IDR)</Label>
              <Input
                id='record-price'
                type='number'
                inputMode='numeric'
                min='0'
                step='500'
                value={form.price}
                onChange={(e) =>
                  setForm((f) => ({ ...f, price: e.target.value }))
                }
                placeholder='10000'
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='record-sold-at'>Sold At</Label>
              <Input
                id='record-sold-at'
                type='datetime-local'
                value={form.sold_at}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sold_at: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter className='gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={handleClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={mutation.isPending}>
              {mutation.isPending && (
                <Loader2 className='size-3.5 animate-spin' />
              )}
              Record Sale
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
