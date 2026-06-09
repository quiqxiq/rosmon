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
import { parseAPIError } from '@/lib/api/errors'
import { useCreateRouter, useUpdateRouter } from '../api/queries'
import type { CreateRouterRequest, UpdateRouterRequest } from '../api/schema'
import { useRoutersDialogStore } from '../store/routers-dialog-store'

type Draft = {
  display_name: string
  host: string
  port: number
  username: string
  password: string
  use_tls: 'true' | 'false'
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
        display_name: selectedRouter.display_name,
        host: selectedRouter.host,
        port: selectedRouter.port ?? 8728,
        username: selectedRouter.username,
        password: '',
        use_tls: selectedRouter.use_tls ? 'true' : 'false',
      }
    }
    return {
      display_name: '',
      host: '',
      port: 8728,
      username: 'admin',
      password: '',
      use_tls: 'false',
    }
  })

  const isPending = createMut.isPending || updateMut.isPending

  const set =
    (key: keyof Draft) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setDraft((d) => ({ ...d, [key]: e.target.value }))

  const setPort = (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((d) => ({ ...d, port: Number(e.target.value) }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!draft.display_name.trim()) return toast.error('Name is required')
    if (!draft.host.trim()) return toast.error('Host is required')
    if (!draft.port || draft.port < 1 || draft.port > 65535)
      return toast.error('Port must be between 1 and 65535')
    if (!draft.username.trim()) return toast.error('Username is required')

    if (mode === 'create') {
      if (!draft.password) return toast.error('Password is required')
      const body: CreateRouterRequest = {
        display_name: draft.display_name.trim(),
        host: draft.host.trim(),
        port: draft.port,
        username: draft.username.trim(),
        password: draft.password,
        use_tls: draft.use_tls === 'true',
      }
      createMut.mutate(body, {
        onSuccess: () => {
          toast.success(`Router '${body.display_name}' added`)
          onClose()
        },
        onError: (err) =>
          toast.error('Failed to add router', {
            description: parseAPIError(err),
          }),
      })
      return
    }

    if (!selectedRouter) return
    const body: UpdateRouterRequest = {}
    if (draft.display_name.trim() !== selectedRouter.display_name)
      body.display_name = draft.display_name.trim()
    if (draft.host.trim() !== selectedRouter.host)
      body.host = draft.host.trim()
    if (draft.port !== (selectedRouter.port ?? 8728))
      body.port = draft.port
    if (draft.username.trim() !== selectedRouter.username)
      body.username = draft.username.trim()
    if (draft.password) body.password = draft.password
    if ((draft.use_tls === 'true') !== Boolean(selectedRouter.use_tls))
      body.use_tls = draft.use_tls === 'true'

    if (Object.keys(body).length === 0) {
      toast.info('No changes to save')
      onClose()
      return
    }

    updateMut.mutate(
      { id: selectedRouter.id, body },
      {
        onSuccess: () => {
          toast.success(`Router '${selectedRouter.display_name}' updated`)
          onClose()
        },
        onError: (err) =>
          toast.error('Failed to update router', {
            description: parseAPIError(err),
          }),
      },
    )
  }

  return (
    <DialogContent className='sm:max-w-md'>
      <form onSubmit={handleSubmit} className='space-y-4'>
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? 'Add Router'
              : `Edit '${selectedRouter?.display_name}'`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'create'
              ? 'Add a new MikroTik router. The connection is tested before saving.'
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
              value={draft.display_name}
              onChange={set('display_name')}
              disabled={isPending}
              maxLength={128}
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='router-host'>Host</Label>
            <Input
              id='router-host'
              autoComplete='off'
              placeholder='192.168.1.1'
              value={draft.host}
              onChange={set('host')}
              disabled={isPending}
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='router-port'>Port</Label>
            <Input
              id='router-port'
              type='number'
              min={1}
              max={65535}
              placeholder='8728'
              value={draft.port}
              onChange={setPort}
              disabled={isPending}
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='router-username'>Username</Label>
            <Input
              id='router-username'
              autoComplete='off'
              placeholder='admin'
              value={draft.username}
              onChange={set('username')}
              disabled={isPending}
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='router-password'>
              Password
              {mode === 'edit' && (
                <span className='ml-1 text-[11px] text-muted-foreground'>
                  (optional — blank to keep)
                </span>
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
            />
          </div>

          <div className='space-y-1.5'>
            <Label htmlFor='router-tls'>Use TLS</Label>
            <Select
              value={draft.use_tls}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, use_tls: v as 'true' | 'false' }))
              }
            >
              <SelectTrigger id='router-tls'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='false'>No (api 8728)</SelectItem>
                <SelectItem value='true'>Yes (api-ssl 8729)</SelectItem>
              </SelectContent>
            </Select>
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
