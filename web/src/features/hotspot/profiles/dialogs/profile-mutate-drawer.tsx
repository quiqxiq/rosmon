import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  useAddHotspotProfile,
  useUpdateHotspotProfile,
} from '../api/queries'
import type { HotspotProfileParams } from '../api/schema'
import { expModeOptions } from '../data/data'
import { type HotspotProfileViewModel } from '../components/view-model'
import { useProfilesDialogStore } from '../store/profiles-dialog-store'

const SHARED_OPTIONS = ['1', '2', '3', '5', '10', 'unlimited']
const PARENT_QUEUE_OPTIONS = ['none', 'global', 'hs-parent']

// Local form draft. Field names match the API param shape so we can
// submit the body with no transformation step. Numbers are kept as
// numbers (API expects ints for price/selling_price).
type ProfileDraft = {
  name: string
  rate_limit: string
  shared_users: string
  parent_queue: string
  address_pool: string
  validity: string
  expire_mode: string
  price: number
  selling_price: number
  lock_user: string
  lock_server: string
}

function emptyDraft(): ProfileDraft {
  return {
    name: '',
    rate_limit: '1M/1M',
    shared_users: '1',
    parent_queue: 'none',
    address_pool: '',
    validity: '1h',
    expire_mode: 'rem',
    price: 0,
    selling_price: 0,
    lock_user: 'enable',
    lock_server: 'disable',
  }
}

function draftFromTarget(target: HotspotProfileViewModel): ProfileDraft {
  return {
    name: target.name,
    rate_limit: target.rateLimit,
    shared_users: target.sharedUsers || '1',
    parent_queue: target.parentQueue || 'none',
    address_pool: target.addressPool,
    validity: target.validity,
    expire_mode: target.expMode || 'rem',
    price: target.price,
    selling_price: target.sellingPrice,
    lock_user: target.lockUser ? 'enable' : 'disable',
    lock_server: target.lockServer ? 'enable' : 'disable',
  }
}

export function ProfileMutateDrawer() {
  const { mode, target, close } = useProfilesDialogStore()
  const isOpen = mode === 'add' || mode === 'edit'
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && (
        <ProfileForm
          key={target?.id ?? `add-${mode}`}
          mode={mode === 'edit' ? 'edit' : 'add'}
          target={target}
          onClose={close}
        />
      )}
    </Sheet>
  )
}

type ProfileFormProps = {
  mode: 'add' | 'edit'
  target: HotspotProfileViewModel | null
  onClose: () => void
}

function ProfileForm({ mode, target, onClose }: ProfileFormProps) {
  const routerId = useActiveRouterId() ?? 0
  const addMutation = useAddHotspotProfile(routerId)
  const updateMutation = useUpdateHotspotProfile(routerId)

  const [draft, setDraft] = useState<ProfileDraft>(() =>
    mode === 'edit' && target ? draftFromTarget(target) : emptyDraft(),
  )

  const update = <K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.name.trim()) {
      toast.error('Profile name is required')
      return
    }
    // Strip empty optional fields so the API doesn't overwrite previously
    // set values with blank strings on edit.
    const payload: HotspotProfileParams = {
      name: draft.name.trim(),
      rate_limit: draft.rate_limit || undefined,
      shared_users: draft.shared_users || undefined,
      parent_queue: draft.parent_queue || undefined,
      address_pool: draft.address_pool || undefined,
      validity: draft.validity || undefined,
      expire_mode: draft.expire_mode || undefined,
      price: draft.price,
      selling_price: draft.selling_price,
      lock_user: draft.lock_user || undefined,
      lock_server: draft.lock_server || undefined,
    }

    if (mode === 'add') {
      addMutation.mutate(payload, {
        onSuccess: () => {
          toast.success(`Profile '${draft.name}' added`)
          onClose()
        },
        onError: (err) => {
          toast.error('Failed to add profile', {
            description: err instanceof Error ? err.message : String(err),
          })
        },
      })
    } else if (target) {
      updateMutation.mutate(
        { id: target.id, params: payload },
        {
          onSuccess: () => {
            toast.success(`Profile '${draft.name}' updated`)
            onClose()
          },
          onError: (err) => {
            toast.error('Failed to update profile', {
              description: err instanceof Error ? err.message : String(err),
            })
          },
        },
      )
    }
  }

  const isPending = addMutation.isPending || updateMutation.isPending

  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
      <SheetHeader className='border-b'>
        <SheetTitle>
          {mode === 'add' ? 'Add Profile' : 'Edit Profile'}
        </SheetTitle>
        <SheetDescription>
          Hotspot user profile · pricing · rate-limit
        </SheetDescription>
      </SheetHeader>

      <form
        id='profile-form'
        className='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4'
        onSubmit={handleSubmit}
      >
        <Field label='Name'>
          <Input
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder='1jam-1k'
            // `name` is the immutable identifier — disable on edit so
            // the user can't accidentally rename and break references.
            disabled={mode === 'edit'}
          />
        </Field>

        <div className='grid grid-cols-2 gap-3'>
          <Field label='Rate Limit'>
            <Input
              value={draft.rate_limit}
              onChange={(e) => update('rate_limit', e.target.value)}
              placeholder='1M/1M'
            />
          </Field>
          <Field label='Validity'>
            <Input
              value={draft.validity}
              onChange={(e) => update('validity', e.target.value)}
              placeholder='1h, 1d, 7d, 30d'
            />
          </Field>
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <Field label='Price'>
            <Input
              type='number'
              min={0}
              value={draft.price}
              onChange={(e) =>
                update('price', Math.max(0, +e.target.value || 0))
              }
            />
          </Field>
          <Field label='Selling Price'>
            <Input
              type='number'
              min={0}
              value={draft.selling_price}
              onChange={(e) =>
                update('selling_price', Math.max(0, +e.target.value || 0))
              }
            />
          </Field>
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <Field label='Shared Users'>
            <Select
              value={draft.shared_users}
              onValueChange={(v) => update('shared_users', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHARED_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label='Exp Mode'>
            <Select
              value={draft.expire_mode}
              onValueChange={(v) => update('expire_mode', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {expModeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <Field label='Address Pool'>
            <Input
              value={draft.address_pool}
              onChange={(e) => update('address_pool', e.target.value)}
              placeholder='Optional'
            />
          </Field>
          <Field label='Parent Queue'>
            <Select
              value={draft.parent_queue}
              onValueChange={(v) => update('parent_queue', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARENT_QUEUE_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className='grid grid-cols-2 gap-3'>
          <Field label='Lock User'>
            <Select
              value={draft.lock_user}
              onValueChange={(v) => update('lock_user', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='enable'>Enable</SelectItem>
                <SelectItem value='disable'>Disable</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label='Lock Server'>
            <Select
              value={draft.lock_server}
              onValueChange={(v) => update('lock_server', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='enable'>Enable</SelectItem>
                <SelectItem value='disable'>Disable</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
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
          form='profile-form'
          disabled={isPending}
          className='gap-1.5'
        >
          {isPending && <Loader2 className='size-4 animate-spin' />}
          {mode === 'add' ? 'Add Profile' : 'Save Changes'}
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
