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
import { Textarea } from '@/components/ui/textarea'
import { useCreateRouter, useUpdateRouter } from '../api/queries'
import type { CreateRouterRequest, UpdateRouterRequest } from '../api/schema'
import { useRoutersDialogStore } from '../store/routers-dialog-store'

type Draft = {
  name: string
  ip_address: string
  api_port: string
  api_username: string
  password: string
  notes: string
}

export function RoutersMutateDialog() {
  const { mode, selectedRouter, close } = useRoutersDialogStore()
  const isOpen = mode === 'create' || mode === 'edit'

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && (
        <RoutersMutateForm
          key={selectedRouter?.id ?? 'create'}
          mode={mode === 'edit' ? 'edit' : 'create'}
          onClose={close}
        />
      )}
    </Dialog>
  )
}

type FormProps = {
  mode: 'create' | 'edit'
  onClose: () => void
}

function RoutersMutateForm({ mode, onClose }: FormProps) {
  const { selectedRouter } = useRoutersDialogStore()
  const createMut = useCreateRouter()
  const updateMut = useUpdateRouter()

  const [draft, setDraft] = useState<Draft>(() => {
    if (mode === 'edit' && selectedRouter) {
      return {
        name: selectedRouter.name,
        ip_address: selectedRouter.ip_address,
        api_port: String(selectedRouter.api_port),
        api_username: selectedRouter.api_username,
        password: '',
        notes: selectedRouter.notes ?? '',
      }
    }
    return {
      name: '',
      ip_address: '',
      api_port: '8728',
      api_username: '',
      password: '',
      notes: '',
    }
  })

  const isPending = createMut.isPending || updateMut.isPending

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const port = parseInt(draft.api_port, 10)
    if (!draft.name.trim()) return toast.error('Name is required')
    if (!draft.ip_address.trim()) return toast.error('IP address is required')
    if (isNaN(port) || port < 1 || port > 65535) return toast.error('API port must be 1–65535')
    if (!draft.api_username.trim()) return toast.error('Username is required')

    if (mode === 'create') {
      if (!draft.password) return toast.error('Password is required')
      const body: CreateRouterRequest = {
        name: draft.name.trim(),
        ip_address: draft.ip_address.trim(),
        api_port: port,
        api_username: draft.api_username.trim(),
        password: draft.password,
        notes: draft.notes.trim() || undefined,
      }
      createMut.mutate(body, {
        onSuccess: () => {
          toast.success(`Router '${body.name}' added`)
          onClose()
        },
        onError: (err) => toast.error('Failed to add router', { description: err.message }),
      })
      return
    }

    if (!selectedRouter) return
    const body: UpdateRouterRequest = {}
    if (draft.name.trim() !== selectedRouter.name) body.name = draft.name.trim()
    if (draft.ip_address.trim() !== selectedRouter.ip_address) body.ip_address = draft.ip_address.trim()
    if (port !== selectedRouter.api_port) body.api_port = port
    if (draft.api_username.trim() !== selectedRouter.api_username) body.api_username = draft.api_username.trim()
    if (draft.password) body.password = draft.password
    const notes = draft.notes.trim() || undefined
    if (notes !== (selectedRouter.notes ?? undefined)) body.notes = notes

    if (Object.keys(body).length === 0) {
      toast.info('No changes to save')
      onClose()
      return
    }

    updateMut.mutate(
      { id: selectedRouter.id, body },
      {
        onSuccess: () => {
          toast.success(`Router '${selectedRouter.name}' updated`)
          onClose()
        },
        onError: (err) => toast.error('Failed to update router', { description: err.message }),
      },
    )
  }

  return (
    <DialogContent className='sm:max-w-md'>
      <form onSubmit={handleSubmit} className='space-y-4'>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add Router' : `Edit '${selectedRouter?.name}'`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add a new MikroTik router. The connection will be tested before saving.'
              : 'Update router details. Leave password blank to keep the current one.'}
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-3'>
          <div className='space-y-1.5'>
            <Label htmlFor='router-name'>Name</Label>
            <Input
              id='router-name'
              autoFocus
              autoComplete='off'
              placeholder='Office Router'
              value={draft.name}
              onChange={set('name')}
              disabled={isPending}
              maxLength={100}
            />
          </div>

          <div className='grid grid-cols-[1fr_auto] gap-2'>
            <div className='space-y-1.5'>
              <Label htmlFor='router-ip'>IP Address</Label>
              <Input
                id='router-ip'
                autoComplete='off'
                placeholder='192.168.1.1'
                value={draft.ip_address}
                onChange={set('ip_address')}
                disabled={isPending}
                maxLength={255}
              />
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='router-port'>API Port</Label>
              <Input
                id='router-port'
                type='number'
                min={1}
                max={65535}
                className='w-24'
                value={draft.api_port}
                onChange={set('api_port')}
                disabled={isPending}
              />
            </div>
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='router-username'>API Username</Label>
            <Input
              id='router-username'
              autoComplete='off'
              placeholder='admin'
              value={draft.api_username}
              onChange={set('api_username')}
              disabled={isPending}
              maxLength={64}
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='router-password'>
              Password
              {mode === 'edit' && (
                <span className='ml-1 text-[11px] text-muted-foreground'>(optional — blank to keep)</span>
              )}
            </Label>
            <Input
              id='router-password'
              type='password'
              autoComplete='new-password'
              placeholder={mode === 'edit' ? 'Leave blank to keep' : ''}
              value={draft.password}
              onChange={set('password')}
              disabled={isPending}
              maxLength={128}
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='router-notes'>
              Notes
              <span className='ml-1 text-[11px] text-muted-foreground'>(optional)</span>
            </Label>
            <Textarea
              id='router-notes'
              className='resize-none'
              placeholder='Location, purpose, etc.'
              value={draft.notes}
              onChange={set('notes')}
              disabled={isPending}
              maxLength={500}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type='button' variant='outline' disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button type='submit' disabled={isPending}>
            {isPending && <Loader2 className='size-4 animate-spin' />}
            {mode === 'create' ? 'Add Router' : 'Save changes'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
