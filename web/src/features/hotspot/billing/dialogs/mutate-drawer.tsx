import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { parseAPIError } from '@/lib/api/errors'
import {
  useCreateHotspotDbProfile,
  useUpdateHotspotDbProfile,
} from '../api/queries'
import {
  type ExpiryMode,
  type HotspotDbProfile,
  type HotspotRole,
} from '../api/schema'
import { useHotspotBillingDialogStore } from '../store/dialog-store'

type Draft = {
  name: string
  role: HotspotRole
  rate_limit: string
  address_pool: string
  shared_users: string
  status_autorefresh: string
  parent_queue: string
  description: string
  active: 'true' | 'false'
  price_monthly: string
  expiry_mode: ExpiryMode
  validity: string
  price: string
  sell_price: string
  lock_mac: 'true' | 'false'
  is_public: boolean
}

function emptyDraft(): Draft {
  return {
    name: '',
    role: 'voucher',
    rate_limit: '',
    address_pool: '',
    shared_users: '1',
    status_autorefresh: '1m',
    parent_queue: '',
    description: '',
    active: 'true',
    price_monthly: '',
    expiry_mode: '0',
    validity: '',
    price: '',
    sell_price: '',
    lock_mac: 'false',
    is_public: false,
  }
}

function draftFromTarget(p: HotspotDbProfile): Draft {
  return {
    name: p.name,
    role: p.role,
    rate_limit: p.rate_limit ?? '',
    address_pool: p.address_pool ?? '',
    shared_users: p.shared_users ? String(p.shared_users) : '1',
    status_autorefresh: p.status_autorefresh ?? '1m',
    parent_queue: p.parent_queue ?? '',
    description: p.description ?? '',
    active: p.active ? 'true' : 'false',
    price_monthly: p.price_monthly ? String(p.price_monthly) : '',
    expiry_mode: (p.expiry_mode as ExpiryMode) ?? '0',
    validity: p.validity ?? '',
    price: p.price ? String(p.price) : '',
    sell_price: p.sell_price ? String(p.sell_price) : '',
    lock_mac: p.lock_mac ? 'true' : 'false',
    is_public: p.is_public ?? false,
  }
}

const EXPIRY_MODES: { value: ExpiryMode; label: string }[] = [
  { value: '0', label: 'No expiry' },
  { value: 'rem', label: 'Remove on expiry' },
  { value: 'ntf', label: 'Notify on expiry' },
  { value: 'remc', label: 'Remove + record' },
  { value: 'ntfc', label: 'Notify + record' },
]

export function HotspotBillingMutateDrawer() {
  const { mode, target, close } = useHotspotBillingDialogStore()
  const isOpen = mode === 'add' || mode === 'edit'
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && (
        <Form
          key={target?.id ?? `add-${mode}`}
          mode={mode === 'edit' ? 'edit' : 'add'}
          target={target}
          onClose={close}
        />
      )}
    </Sheet>
  )
}

function Form({
  mode,
  target,
  onClose,
}: {
  mode: 'add' | 'edit'
  target: HotspotDbProfile | null
  onClose: () => void
}) {
  const routerId = useActiveRouterId() ?? 0
  const createMutation = useCreateHotspotDbProfile(routerId)
  const updateMutation = useUpdateHotspotDbProfile(routerId)
  const [draft, setDraft] = useState<Draft>(() =>
    mode === 'edit' && target ? draftFromTarget(target) : emptyDraft(),
  )

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const num = (s: string) => {
    const n = Number(s)
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'add' && !draft.name.trim()) {
      toast.error('Name is required')
      return
    }

    const mikrotik = {
      rate_limit: draft.rate_limit.trim(),
      address_pool: draft.address_pool.trim(),
      shared_users: num(draft.shared_users) || 1,
      status_autorefresh: draft.status_autorefresh.trim() || '1m',
      parent_queue: draft.parent_queue.trim(),
      description: draft.description.trim(),
      active: draft.active === 'true',
    }
    const billing =
      draft.role === 'permanent'
        ? { price_monthly: num(draft.price_monthly), is_public: draft.is_public }
        : {
            expiry_mode: draft.expiry_mode,
            validity: draft.validity.trim(),
            price: num(draft.price),
            sell_price: num(draft.sell_price),
            lock_mac: draft.lock_mac === 'true',
          }

    if (mode === 'add') {
      createMutation.mutate(
        { name: draft.name.trim(), role: draft.role, ...mikrotik, ...billing },
        {
          onSuccess: (res) => {
            toast.success(`Profile '${draft.name}' created`, {
              description: res.warning,
            })
            onClose()
          },
          onError: (err) =>
            toast.error('Failed to create profile', {
              description: parseAPIError(err),
            }),
        },
      )
      return
    }

    if (!target) return
    updateMutation.mutate(
      { id: target.id, payload: { ...mikrotik, ...billing } },
      {
        onSuccess: (res) => {
          toast.success(`Profile '${draft.name}' updated`, {
            description: res.warning,
          })
          onClose()
        },
        onError: (err) =>
          toast.error('Failed to update profile', {
            description: parseAPIError(err),
          }),
      },
    )
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const role = draft.role

  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
      <SheetHeader className='border-b'>
        <SheetTitle>
          {mode === 'add' ? 'Add Hotspot Profile' : 'Edit Hotspot Profile'}
        </SheetTitle>
        <SheetDescription>
          DB-backed hotspot plan · synced to RouterOS best-effort
        </SheetDescription>
      </SheetHeader>

      <form
        id='hs-db-profile-form'
        className='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4'
        onSubmit={handleSubmit}
      >
        <Field label='Name'>
          <Input
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder='1day'
            disabled={mode === 'edit'}
          />
        </Field>
        <Field label='Role'>
          <Select
            value={draft.role}
            onValueChange={(v) => update('role', v as HotspotRole)}
            disabled={mode === 'edit'}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='voucher'>Voucher</SelectItem>
              <SelectItem value='permanent'>Permanent</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label='Rate Limit (rx/tx)'>
          <Input
            value={draft.rate_limit}
            onChange={(e) => update('rate_limit', e.target.value)}
            placeholder='5M/5M'
          />
        </Field>

        {role === 'permanent' ? (
          <>
            <Field label='Price / month (IDR)'>
              <Input
                type='number'
                min='0'
                value={draft.price_monthly}
                onChange={(e) => update('price_monthly', e.target.value)}
                placeholder='100000'
              />
            </Field>
            <div className='flex items-center justify-between rounded-md border px-3 py-2'>
              <div>
                <Label className='text-sm font-medium'>Public package</Label>
                <p className='text-xs text-muted-foreground'>
                  Show on the public registration page.
                </p>
              </div>
              <Switch
                checked={draft.is_public}
                onCheckedChange={(v) => update('is_public', v)}
              />
            </div>
          </>
        ) : (
          <>
            <Field label='Expiry Mode'>
              <Select
                value={draft.expiry_mode}
                onValueChange={(v) => update('expiry_mode', v as ExpiryMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label='Validity'>
              <Input
                value={draft.validity}
                onChange={(e) => update('validity', e.target.value)}
                placeholder='1d'
              />
            </Field>
            <div className='grid grid-cols-2 gap-3'>
              <Field label='Cost (IDR)'>
                <Input
                  type='number'
                  min='0'
                  value={draft.price}
                  onChange={(e) => update('price', e.target.value)}
                  placeholder='3000'
                />
              </Field>
              <Field label='Sell Price (IDR)'>
                <Input
                  type='number'
                  min='0'
                  value={draft.sell_price}
                  onChange={(e) => update('sell_price', e.target.value)}
                  placeholder='5000'
                />
              </Field>
            </div>
            <Field label='Lock to MAC'>
              <Select
                value={draft.lock_mac}
                onValueChange={(v) => update('lock_mac', v as 'true' | 'false')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='false'>No</SelectItem>
                  <SelectItem value='true'>Yes</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </>
        )}

        <div className='grid grid-cols-2 gap-3'>
          <Field label='Address Pool'>
            <Input
              value={draft.address_pool}
              onChange={(e) => update('address_pool', e.target.value)}
              placeholder='hs-pool'
            />
          </Field>
          <Field label='Shared Users'>
            <Input
              type='number'
              min='1'
              value={draft.shared_users}
              onChange={(e) => update('shared_users', e.target.value)}
            />
          </Field>
        </div>
        <div className='grid grid-cols-2 gap-3'>
          <Field label='Status Autorefresh'>
            <Input
              value={draft.status_autorefresh}
              onChange={(e) => update('status_autorefresh', e.target.value)}
              placeholder='1m'
            />
          </Field>
          <Field label='Parent Queue'>
            <Input
              value={draft.parent_queue}
              onChange={(e) => update('parent_queue', e.target.value)}
              placeholder='queue name'
            />
          </Field>
        </div>
        <Field label='Description'>
          <Input
            value={draft.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder='1 day voucher'
          />
        </Field>
        <Field label='Status'>
          <Select
            value={draft.active}
            onValueChange={(v) => update('active', v as 'true' | 'false')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='true'>Active</SelectItem>
              <SelectItem value='false'>Inactive</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </form>

      <SheetFooter className='border-t'>
        <SheetClose asChild>
          <Button variant='outline' size='sm' disabled={isPending}>
            Cancel
          </Button>
        </SheetClose>
        <Button
          type='submit'
          size='sm'
          form='hs-db-profile-form'
          disabled={isPending}
          className='gap-1.5'
        >
          {isPending && <Loader2 className='size-4 animate-spin' />}
          {mode === 'add' ? 'Create Profile' : 'Save Changes'}
        </Button>
      </SheetFooter>
    </SheetContent>
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
