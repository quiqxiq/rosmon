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
import { parseAPIError } from '@/lib/api/errors'
import {
  useCreatePPPDbProfile,
  useUpdatePPPDbProfile,
} from '../api/queries'
import {
  type PPPDbProfile,
  type PPPDbProfileCreateInput,
  type PPPDbProfileUpdateInput,
} from '../api/schema'
import { useDbProfilesDialogStore } from '../store/db-profiles-dialog-store'

type Draft = {
  name: string
  rate_limit: string
  price_monthly: string
  local_address: string
  remote_address: string
  session_timeout: string
  idle_timeout: string
  parent_queue: string
  description: string
  active: 'true' | 'false'
}

function emptyDraft(): Draft {
  return {
    name: '',
    rate_limit: '',
    price_monthly: '',
    local_address: '',
    remote_address: '',
    session_timeout: '',
    idle_timeout: '',
    parent_queue: '',
    description: '',
    active: 'true',
  }
}

function draftFromTarget(t: PPPDbProfile): Draft {
  return {
    name: t.name,
    rate_limit: t.rate_limit ?? '',
    price_monthly: t.price_monthly ? String(t.price_monthly) : '',
    local_address: t.local_address ?? '',
    remote_address: t.remote_address ?? '',
    session_timeout: t.session_timeout ?? '',
    idle_timeout: t.idle_timeout ?? '',
    parent_queue: t.parent_queue ?? '',
    description: t.description ?? '',
    active: t.active ? 'true' : 'false',
  }
}

export function DbProfileMutateDrawer() {
  const { mode, target, close } = useDbProfilesDialogStore()
  const isOpen = mode === 'add' || mode === 'edit'
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && (
        <DbProfileForm
          key={target?.id ?? `add-${mode}`}
          mode={mode === 'edit' ? 'edit' : 'add'}
          target={target}
          onClose={close}
        />
      )}
    </Sheet>
  )
}

type DbProfileFormProps = {
  mode: 'add' | 'edit'
  target: PPPDbProfile | null
  onClose: () => void
}

function DbProfileForm({ mode, target, onClose }: DbProfileFormProps) {
  const routerId = useActiveRouterId() ?? 0
  const createMutation = useCreatePPPDbProfile(routerId)
  const updateMutation = useUpdatePPPDbProfile(routerId)

  const [draft, setDraft] = useState<Draft>(() =>
    mode === 'edit' && target ? draftFromTarget(target) : emptyDraft(),
  )

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const parsePrice = (): number => {
    const n = Number(draft.price_monthly)
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'add' && !draft.name.trim()) {
      toast.error('Name is required')
      return
    }

    const common = {
      rate_limit: draft.rate_limit.trim(),
      local_address: draft.local_address.trim(),
      remote_address: draft.remote_address.trim(),
      session_timeout: draft.session_timeout.trim(),
      idle_timeout: draft.idle_timeout.trim(),
      parent_queue: draft.parent_queue.trim(),
      description: draft.description.trim(),
      price_monthly: parsePrice(),
      active: draft.active === 'true',
    }

    if (mode === 'add') {
      const payload: PPPDbProfileCreateInput = {
        name: draft.name.trim(),
        ...common,
      }
      createMutation.mutate(payload, {
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
      })
      return
    }

    if (!target) return
    const payload: PPPDbProfileUpdateInput = { ...common }
    updateMutation.mutate(
      { id: target.id, payload },
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

  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
      <SheetHeader className='border-b'>
        <SheetTitle>
          {mode === 'add' ? 'Add Billing Profile' : 'Edit Billing Profile'}
        </SheetTitle>
        <SheetDescription>
          DB-backed PPP plan · synced to RouterOS best-effort
        </SheetDescription>
      </SheetHeader>

      <form
        id='ppp-db-profile-form'
        className='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4'
        onSubmit={handleSubmit}
      >
        <Field label='Name'>
          <Input
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder='paket-10M'
            autoComplete='off'
            disabled={mode === 'edit'}
          />
        </Field>
        <div className='grid grid-cols-2 gap-3'>
          <Field label='Rate Limit (rx/tx)'>
            <Input
              value={draft.rate_limit}
              onChange={(e) => update('rate_limit', e.target.value)}
              placeholder='10M/10M'
            />
          </Field>
          <Field label='Price / month (IDR)'>
            <Input
              type='number'
              min='0'
              value={draft.price_monthly}
              onChange={(e) => update('price_monthly', e.target.value)}
              placeholder='150000'
            />
          </Field>
        </div>
        <div className='grid grid-cols-2 gap-3'>
          <Field label='Local Address'>
            <Input
              value={draft.local_address}
              onChange={(e) => update('local_address', e.target.value)}
              placeholder='10.0.0.1'
            />
          </Field>
          <Field label='Remote Address'>
            <Input
              value={draft.remote_address}
              onChange={(e) => update('remote_address', e.target.value)}
              placeholder='pool name / IP'
            />
          </Field>
        </div>
        <div className='grid grid-cols-2 gap-3'>
          <Field label='Session Timeout'>
            <Input
              value={draft.session_timeout}
              onChange={(e) => update('session_timeout', e.target.value)}
              placeholder='1h30m'
            />
          </Field>
          <Field label='Idle Timeout'>
            <Input
              value={draft.idle_timeout}
              onChange={(e) => update('idle_timeout', e.target.value)}
              placeholder='10m'
            />
          </Field>
        </div>
        <Field label='Parent Queue'>
          <Input
            value={draft.parent_queue}
            onChange={(e) => update('parent_queue', e.target.value)}
            placeholder='queue name'
          />
        </Field>
        <Field label='Description'>
          <Input
            value={draft.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder='Home 10 Mbps plan'
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
          form='ppp-db-profile-form'
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
