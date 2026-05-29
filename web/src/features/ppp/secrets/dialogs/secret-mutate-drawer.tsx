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
import { useAddPPPSecret, useUpdatePPPSecret } from '../api/queries'
import {
  PPP_SERVICES,
  type PPPSecret,
  type PPPSecretCreateInput,
  type PPPSecretUpdateInput,
} from '../api/schema'
import { useSecretsDialogStore } from '../store/secrets-dialog-store'

type SecretDraft = {
  name: string
  password: string
  service: string
  profile: string
  local_address: string
  remote_address: string
  comment: string
}

function emptyDraft(): SecretDraft {
  return {
    name: '',
    password: '',
    service: 'any',
    profile: '',
    local_address: '',
    remote_address: '',
    comment: '',
  }
}

function draftFromTarget(target: PPPSecret): SecretDraft {
  return {
    name: target.name,
    password: '',
    service: target.service || 'any',
    profile: target.profile ?? '',
    local_address: target.local_address ?? '',
    remote_address: target.remote_address ?? '',
    comment: target.comment ?? '',
  }
}

export function SecretMutateDrawer() {
  const { mode, target, close } = useSecretsDialogStore()
  const isOpen = mode === 'add' || mode === 'edit'
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && (
        <SecretForm
          key={target?.id ?? `add-${mode}`}
          mode={mode === 'edit' ? 'edit' : 'add'}
          target={target}
          onClose={close}
        />
      )}
    </Sheet>
  )
}

type SecretFormProps = {
  mode: 'add' | 'edit'
  target: PPPSecret | null
  onClose: () => void
}

function SecretForm({ mode, target, onClose }: SecretFormProps) {
  const routerId = useActiveRouterId() ?? 0
  const addMutation = useAddPPPSecret(routerId)
  const updateMutation = useUpdatePPPSecret(routerId)

  const [draft, setDraft] = useState<SecretDraft>(() =>
    mode === 'edit' && target ? draftFromTarget(target) : emptyDraft(),
  )

  const update = <K extends keyof SecretDraft>(
    key: K,
    value: SecretDraft[K],
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.name.trim()) {
      toast.error('Username is required')
      return
    }

    if (mode === 'add') {
      if (!draft.password.trim()) {
        toast.error('Password is required')
        return
      }
      const payload: PPPSecretCreateInput = {
        name: draft.name.trim(),
        password: draft.password,
        service: draft.service,
      }
      if (draft.profile.trim()) payload.profile = draft.profile.trim()
      if (draft.local_address.trim())
        payload.local_address = draft.local_address.trim()
      if (draft.remote_address.trim())
        payload.remote_address = draft.remote_address.trim()
      addMutation.mutate(payload, {
        onSuccess: () => {
          toast.success(`Secret '${draft.name}' added`)
          onClose()
        },
        onError: (err) =>
          toast.error('Failed to add secret', {
            description: parseAPIError(err),
          }),
      })
      return
    }

    if (!target) return
    const patch: PPPSecretUpdateInput = {
      name: draft.name.trim(),
      service: draft.service,
      profile: draft.profile.trim(),
      local_address: draft.local_address.trim(),
      remote_address: draft.remote_address.trim(),
      comment: draft.comment.trim(),
    }
    if (draft.password.trim()) patch.password = draft.password
    updateMutation.mutate(
      { id: target.id, patch },
      {
        onSuccess: () => {
          toast.success(`Secret '${draft.name}' updated`)
          onClose()
        },
        onError: (err) =>
          toast.error('Failed to update secret', {
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
          {mode === 'add' ? 'Add PPP Secret' : 'Edit PPP Secret'}
        </SheetTitle>
        <SheetDescription>
          PPPoE / PPP credential · profile · addresses
        </SheetDescription>
      </SheetHeader>

      <form
        id='secret-form'
        className='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4'
        onSubmit={handleSubmit}
      >
        <div className='grid grid-cols-2 gap-3'>
          <Field label='Username'>
            <Input
              value={draft.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder='pppoe-001'
              autoComplete='off'
            />
          </Field>
          <Field
            label={mode === 'edit' ? 'Password (leave blank to keep)' : 'Password'}
          >
            <Input
              value={draft.password}
              onChange={(e) => update('password', e.target.value)}
              placeholder='••••'
              autoComplete='off'
            />
          </Field>
        </div>

        <Field label='Service'>
          <Select
            value={draft.service}
            onValueChange={(v) => update('service', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PPP_SERVICES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label='Profile'>
          <Input
            value={draft.profile}
            onChange={(e) => update('profile', e.target.value)}
            placeholder='default'
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
              placeholder='10.0.0.2 / pool'
            />
          </Field>
        </div>

        {mode === 'edit' && (
          <Field label='Comment'>
            <Input
              value={draft.comment}
              onChange={(e) => update('comment', e.target.value)}
              placeholder='Optional'
            />
          </Field>
        )}
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
          form='secret-form'
          disabled={isPending}
          className='gap-1.5'
        >
          {isPending && <Loader2 className='size-4 animate-spin' />}
          {mode === 'add' ? 'Add Secret' : 'Save Changes'}
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
