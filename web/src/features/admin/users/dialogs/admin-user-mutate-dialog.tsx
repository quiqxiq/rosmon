import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
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
import { Switch } from '@/components/ui/switch'
import {
  useCreateAdminUser,
  useUpdateAdminUser,
} from '../api/queries'
import type {
  AdminUser,
  AdminUserRole,
  CreateAdminUserRequest,
  UpdateAdminUserRequest,
} from '../api/schema'
import { useAdminUsersDialogStore } from '../store/admin-users-dialog-store'

// Shared mutate dialog for both Add and Edit. Splitting into two separate
// dialogs would duplicate ~80% of this form for almost no benefit; we
// branch on `mode` inside the inner form instead. The key prop on
// AdminUserForm resets local draft state when switching between an Add
// session and an Edit session against a specific user.
export function AdminUserMutateDialog() {
  const { mode, target, close } = useAdminUsersDialogStore()
  const isOpen = mode === 'add' || mode === 'edit'

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && (
        <AdminUserForm
          key={target?.id ?? `add-${mode}`}
          mode={mode === 'edit' ? 'edit' : 'add'}
          target={target}
          onClose={close}
        />
      )}
    </Dialog>
  )
}

type FormProps = {
  mode: 'add' | 'edit'
  target: AdminUser | null
  onClose: () => void
}

type Draft = {
  username: string
  password: string
  role: AdminUserRole
  active: boolean
}

function AdminUserForm({ mode, target, onClose }: FormProps) {
  const createMut = useCreateAdminUser()
  const updateMut = useUpdateAdminUser()

  const [draft, setDraft] = useState<Draft>(() => {
    if (mode === 'edit' && target) {
      return {
        username: target.username,
        password: '',
        role: target.role,
        active: target.active,
      }
    }
    return { username: '', password: '', role: 'operator', active: true }
  })

  const isPending = createMut.isPending || updateMut.isPending

  // On Edit, password is optional — empty string means "don't change".
  // The backend treats UpdateAdminUserRequest as a partial update, so we
  // strip empty/unchanged fields before sending to avoid no-op writes.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!draft.username.trim()) {
      toast.error('Username is required')
      return
    }
    if (mode === 'add' && draft.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (mode === 'edit' && draft.password.length > 0 && draft.password.length < 6) {
      toast.error('New password must be at least 6 characters (or leave blank)')
      return
    }

    if (mode === 'add') {
      const body: CreateAdminUserRequest = {
        username: draft.username.trim(),
        password: draft.password,
        role: draft.role,
      }
      createMut.mutate(body, {
        onSuccess: () => {
          toast.success(`User '${body.username}' created`)
          onClose()
        },
        onError: (err) => {
          toast.error('Failed to create user', { description: err.message })
        },
      })
      return
    }

    if (!target) return
    const body: UpdateAdminUserRequest = {}
    const trimmed = draft.username.trim()
    if (trimmed !== target.username) body.username = trimmed
    if (draft.password.length > 0) body.password = draft.password
    if (draft.role !== target.role) body.role = draft.role
    if (draft.active !== target.active) body.active = draft.active

    if (Object.keys(body).length === 0) {
      toast.info('No changes to save')
      onClose()
      return
    }

    updateMut.mutate(
      { id: target.id, body },
      {
        onSuccess: () => {
          toast.success(`User '${trimmed}' updated`)
          onClose()
        },
        onError: (err) => {
          toast.error('Failed to update user', { description: err.message })
        },
      },
    )
  }

  return (
    <DialogContent className='sm:max-w-md'>
      <form onSubmit={handleSubmit} className='space-y-4'>
        <DialogHeader>
          <DialogTitle>
            {mode === 'add' ? 'Add admin user' : `Edit '${target?.username}'`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'add'
              ? 'Create a new admin or staff account. Username must be unique.'
              : 'Update account details. Leave password blank to keep the current one.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <div className='space-y-1.5'>
            <Label htmlFor='admin-user-username'>Username</Label>
            <Input
              id='admin-user-username'
              autoComplete='off'
              autoFocus
              value={draft.username}
              onChange={(e) =>
                setDraft((d) => ({ ...d, username: e.target.value }))
              }
              disabled={isPending}
              minLength={3}
              maxLength={64}
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='admin-user-password'>
              {mode === 'add' ? 'Password' : 'New password'}
              {mode === 'edit' && (
                <span className='ml-1 text-[11px] text-muted-foreground'>
                  (optional)
                </span>
              )}
            </Label>
            <Input
              id='admin-user-password'
              type='password'
              autoComplete='new-password'
              value={draft.password}
              onChange={(e) =>
                setDraft((d) => ({ ...d, password: e.target.value }))
              }
              disabled={isPending}
              placeholder={mode === 'edit' ? 'Leave blank to keep' : ''}
              minLength={mode === 'add' ? 6 : 0}
              maxLength={128}
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='admin-user-role'>Role</Label>
            <Select
              value={draft.role}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, role: v as AdminUserRole }))
              }
              disabled={isPending}
            >
              <SelectTrigger id='admin-user-role'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='admin'>Admin — full access</SelectItem>
                <SelectItem value='operator'>Operator — manage & assign</SelectItem>
                <SelectItem value='viewer'>Viewer — read-only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === 'edit' && (
            <div className='flex items-center justify-between rounded-md border px-3 py-2'>
              <div>
                <Label htmlFor='admin-user-active' className='cursor-pointer'>
                  Active
                </Label>
                <p className='text-[11px] text-muted-foreground'>
                  Inactive users cannot sign in.
                </p>
              </div>
              <Switch
                id='admin-user-active'
                checked={draft.active}
                onCheckedChange={(v) =>
                  setDraft((d) => ({ ...d, active: v }))
                }
                disabled={isPending}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type='button' variant='outline' disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button type='submit' disabled={isPending}>
            {isPending && <Loader2 className='size-4 animate-spin' />}
            {mode === 'add' ? 'Create user' : 'Save changes'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
