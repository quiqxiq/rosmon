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
import { useAddPPPProfile, useUpdatePPPProfile } from '../api/queries'
import {
  type RouterPPPProfile,
  type RouterPPPProfileCreateInput,
  type RouterPPPProfileUpdateInput,
} from '../api/schema'
import { useProfilesDialogStore } from '../store/profiles-dialog-store'

type ProfileDraft = {
  name: string
  rate_limit: string
  local_address: string
  remote_address: string
  session_timeout: string
  idle_timeout: string
  parent_queue: string
  comment: string
  disabled: 'true' | 'false'
}

function emptyDraft(): ProfileDraft {
  return {
    name: '',
    rate_limit: '',
    local_address: '',
    remote_address: '',
    session_timeout: '',
    idle_timeout: '',
    parent_queue: '',
    comment: '',
    disabled: 'false',
  }
}

function draftFromTarget(t: RouterPPPProfile): ProfileDraft {
  return {
    name: t.name,
    rate_limit: t.rate_limit ?? '',
    local_address: t.local_address ?? '',
    remote_address: t.remote_address ?? '',
    session_timeout: t.session_timeout ?? '',
    idle_timeout: t.idle_timeout ?? '',
    parent_queue: t.parent_queue ?? '',
    comment: t.comment ?? '',
    disabled: t.disabled ? 'true' : 'false',
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
  target: RouterPPPProfile | null
  onClose: () => void
}

function ProfileForm({ mode, target, onClose }: ProfileFormProps) {
  const routerId = useActiveRouterId() ?? 0
  const addMutation = useAddPPPProfile(routerId)
  const updateMutation = useUpdatePPPProfile(routerId)

  const [draft, setDraft] = useState<ProfileDraft>(() =>
    mode === 'edit' && target ? draftFromTarget(target) : emptyDraft(),
  )

  const update = <K extends keyof ProfileDraft>(
    key: K,
    value: ProfileDraft[K],
  ) => setDraft((prev) => ({ ...prev, [key]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.name.trim()) {
      toast.error('Name is required')
      return
    }
    const common = {
      local_address: draft.local_address.trim(),
      remote_address: draft.remote_address.trim(),
      rate_limit: draft.rate_limit.trim(),
      session_timeout: draft.session_timeout.trim(),
      idle_timeout: draft.idle_timeout.trim(),
      parent_queue: draft.parent_queue.trim(),
      comment: draft.comment.trim(),
      disabled: draft.disabled === 'true',
    }

    if (mode === 'add') {
      const payload: RouterPPPProfileCreateInput = {
        name: draft.name.trim(),
        ...common,
      }
      addMutation.mutate(payload, {
        onSuccess: () => {
          toast.success(`Profile '${draft.name}' added`)
          onClose()
        },
        onError: (err) =>
          toast.error('Failed to add profile', {
            description: parseAPIError(err),
          }),
      })
      return
    }

    if (!target) return
    const patch: RouterPPPProfileUpdateInput = {
      name: draft.name.trim(),
      ...common,
    }
    updateMutation.mutate(
      { id: target.id, patch },
      {
        onSuccess: () => {
          toast.success(`Profile '${draft.name}' updated`)
          onClose()
        },
        onError: (err) =>
          toast.error('Failed to update profile', {
            description: parseAPIError(err),
          }),
      },
    )
  }

  const isPending = addMutation.isPending || updateMutation.isPending

  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
      <SheetHeader className='border-b'>
        <SheetTitle>
          {mode === 'add' ? 'Add PPP Profile' : 'Edit PPP Profile'}
        </SheetTitle>
        <SheetDescription>
          RouterOS /ppp/profile · addresses · rate limit
        </SheetDescription>
      </SheetHeader>

      <form
        id='ppp-profile-form'
        className='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4'
        onSubmit={handleSubmit}
      >
        <Field label='Name'>
          <Input
            value={draft.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder='default'
            autoComplete='off'
          />
        </Field>
        <Field label='Rate Limit (rx/tx)'>
          <Input
            value={draft.rate_limit}
            onChange={(e) => update('rate_limit', e.target.value)}
            placeholder='10M/10M'
          />
        </Field>
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
        <Field label='Status'>
          <Select
            value={draft.disabled}
            onValueChange={(v) => update('disabled', v as 'true' | 'false')}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='false'>Enabled</SelectItem>
              <SelectItem value='true'>Disabled</SelectItem>
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

      <SheetFooter className='border-t'>
        <SheetClose asChild>
          <Button variant='outline' size='sm' disabled={isPending}>
            Cancel
          </Button>
        </SheetClose>
        <Button
          type='submit'
          size='sm'
          form='ppp-profile-form'
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
