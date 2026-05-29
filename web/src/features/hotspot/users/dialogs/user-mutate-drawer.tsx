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
import { useHotspotProfiles } from '@/features/hotspot/profiles/api/queries'
import { useAddHotspotUser, useUpdateHotspotUser } from '../api/queries'
import { type HotspotUserViewModel } from '../components/view-model'
import { useUsersDialogStore } from '../store/users-dialog-store'

// Local form draft kept in RouterOS-key shape so the body we POST/PUT
// matches `HotspotUserMutation` (`Record<string, string>`) with zero
// transformation at submit time.
type UserDraft = {
  name: string
  password: string
  profile: string
  server: string
  'mac-address': string
  comment: string
  disabled: 'true' | 'false'
}

function emptyDraft(profileFallback: string): UserDraft {
  return {
    name: '',
    password: '',
    profile: profileFallback,
    server: 'all',
    'mac-address': '',
    comment: '',
    disabled: 'false',
  }
}

function draftFromTarget(target: HotspotUserViewModel): UserDraft {
  return {
    name: target.name,
    password: target.password,
    profile: target.profile,
    server: target.server || 'all',
    'mac-address': target.macAddress,
    comment: target.comment,
    disabled: target.enabledStatus === 'disabled' ? 'true' : 'false',
  }
}

export function UserMutateDrawer() {
  const { mode, target, close } = useUsersDialogStore()
  const isOpen = mode === 'add' || mode === 'edit'
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && (
        <UserForm
          key={target?.id ?? `add-${mode}`}
          mode={mode === 'edit' ? 'edit' : 'add'}
          target={target}
          onClose={close}
        />
      )}
    </Sheet>
  )
}

type UserFormProps = {
  mode: 'add' | 'edit'
  target: HotspotUserViewModel | null
  onClose: () => void
}

function UserForm({ mode, target, onClose }: UserFormProps) {
  const routerId = useActiveRouterId() ?? 0
  const profilesQuery = useHotspotProfiles(routerId)
  const profiles = profilesQuery.data ?? []
  const profileFallback = profiles[0]?.name ?? ''

  const addMutation = useAddHotspotUser(routerId)
  const updateMutation = useUpdateHotspotUser(routerId)

  const [draft, setDraft] = useState<UserDraft>(() => {
    if (mode === 'edit' && target) return draftFromTarget(target)
    return emptyDraft(profileFallback)
  })

  const update = <K extends keyof UserDraft>(key: K, value: UserDraft[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  // The list of known hotspot servers is not exposed as a hook yet — we
  // hardcode the common defaults plus `all` (the implicit "any server"
  // value). Once `features/hotspot/servers/` ships a query this becomes
  // a Select fed by that source.
  const SERVERS = ['all', 'HS-01', 'HS-02', 'HS-03']

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.name.trim()) {
      toast.error('Username is required')
      return
    }
    if (!draft.password.trim()) {
      toast.error('Password is required')
      return
    }

    // Strip empty optional fields so the API doesn't receive blank
    // `mac-address` keys that would override a previously-set MAC on
    // edit.
    const payload: Record<string, string> = {
      name: draft.name.trim(),
      password: draft.password,
      profile: draft.profile,
      server: draft.server,
      disabled: draft.disabled,
    }
    if (draft['mac-address']) payload['mac-address'] = draft['mac-address']
    if (draft.comment) payload.comment = draft.comment

    if (mode === 'add') {
      addMutation.mutate(payload, {
        onSuccess: () => {
          toast.success(`User '${draft.name}' added`)
          onClose()
        },
        onError: (err) => {
          toast.error('Failed to add user', {
            description: err instanceof Error ? err.message : String(err),
          })
        },
      })
    } else if (target) {
      updateMutation.mutate(
        { id: target.id, patch: payload },
        {
          onSuccess: () => {
            toast.success(`User '${draft.name}' updated`)
            onClose()
          },
          onError: (err) => {
            toast.error('Failed to update user', {
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
          {mode === 'add' ? 'Add Hotspot User' : 'Edit Hotspot User'}
        </SheetTitle>
        <SheetDescription>
          Single hotspot user · credentials · profile
        </SheetDescription>
      </SheetHeader>

      <form
        id='user-form'
        className='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4'
        onSubmit={handleSubmit}
      >
        <div className='grid grid-cols-2 gap-3'>
          <Field label='Username'>
            <Input
              value={draft.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder='wifi-001'
              autoComplete='off'
            />
          </Field>
          <Field label='Password'>
            <Input
              value={draft.password}
              onChange={(e) => update('password', e.target.value)}
              placeholder='••••'
              autoComplete='off'
            />
          </Field>
        </div>

        <Field label='Profile'>
          <Select
            value={draft.profile}
            onValueChange={(v) => update('profile', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder='Select a profile' />
            </SelectTrigger>
            <SelectContent>
              {profiles.length === 0 ? (
                <SelectItem value='__none' disabled>
                  No profiles available
                </SelectItem>
              ) : (
                profiles.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}
                    {p.validity ? ` · ${p.validity}` : ''}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </Field>

        <Field label='Server'>
          <Select
            value={draft.server}
            onValueChange={(v) => update('server', v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVERS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label='MAC Address'>
          <Input
            value={draft['mac-address']}
            onChange={(e) =>
              update('mac-address', e.target.value.toUpperCase())
            }
            placeholder='AA:BB:CC:DD:EE:FF'
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
          form='user-form'
          disabled={isPending}
          className='gap-1.5'
        >
          {isPending && <Loader2 className='size-4 animate-spin' />}
          {mode === 'add' ? 'Add User' : 'Save Changes'}
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
