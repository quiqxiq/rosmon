import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useHotspotProfiles } from '@/features/hotspot/profiles/api/queries'
import { useAddHotspotUser, useUpdateHotspotUser } from '../api/queries'
import { type HotspotUserViewModel } from '../components/view-model'
import { useUsersDialogStore } from '../store/users-dialog-store'

// The list of known hotspot servers is not exposed as a hook yet.
// We hardcode the common defaults plus `all` (implicit "any server").
const SERVERS = ['all', 'HS-01', 'HS-02', 'HS-03']

// ── Schema ──────────────────────────────────────────────────────────────────

const baseSchema = z.object({
  name: z.string().min(1, 'Username wajib diisi'),
  password: z.string(),
  profile: z.string(),
  server: z.string(),
  mac_address: z.string(),
  comment: z.string(),
  disabled: z.enum(['true', 'false']),
})

const addSchema = baseSchema.extend({
  password: z.string().min(1, 'Password wajib diisi'),
})

type UserFormValues = z.infer<typeof baseSchema>

function defaultValues(
  target?: HotspotUserViewModel | null,
  profileFallback = '',
): UserFormValues {
  return {
    name: target?.name ?? '',
    password: target?.password ?? '',
    profile: target?.profile ?? profileFallback,
    server: target?.server ?? 'all',
    mac_address: target?.macAddress ?? '',
    comment: target?.comment ?? '',
    disabled: target?.enabledStatus === 'disabled' ? 'true' : 'false',
  }
}

// ── Root ─────────────────────────────────────────────────────────────────────

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

// ── Form ─────────────────────────────────────────────────────────────────────

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

  const isEdit = mode === 'edit'
  const form = useForm<UserFormValues>({
    resolver: zodResolver(isEdit ? baseSchema : addSchema),
    defaultValues: defaultValues(isEdit ? target : null, profileFallback),
  })

  const isPending = addMutation.isPending || updateMutation.isPending

  const onSubmit = (values: UserFormValues) => {
    const payload: Record<string, string> = {
      name: values.name.trim(),
      password: values.password,
      profile: values.profile,
      server: values.server,
      disabled: values.disabled,
    }
    if (values.mac_address.trim())
      payload['mac-address'] = values.mac_address.trim()
    if (values.comment.trim()) payload.comment = values.comment.trim()

    if (mode === 'add') {
      addMutation.mutate(payload, {
        onSuccess: () => {
          toast.success(`User '${values.name}' ditambahkan`)
          onClose()
        },
        onError: (err) =>
          toast.error('Gagal menambahkan user', {
            description: err instanceof Error ? err.message : String(err),
          }),
      })
    } else if (target) {
      updateMutation.mutate(
        { id: target.id, patch: payload },
        {
          onSuccess: () => {
            toast.success(`User '${values.name}' diperbarui`)
            onClose()
          },
          onError: (err) =>
            toast.error('Gagal memperbarui user', {
              description: err instanceof Error ? err.message : String(err),
            }),
        },
      )
    }
  }

  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
      <SheetHeader className='border-b px-6 py-4'>
        <SheetTitle>
          {mode === 'add' ? 'Add Hotspot User' : 'Edit Hotspot User'}
        </SheetTitle>
        <SheetDescription>
          Single hotspot user · credentials · profile
        </SheetDescription>
      </SheetHeader>

      <Form {...form}>
        <form
          id='hotspot-user-form'
          className='flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5'
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {/* Username + Password */}
          <div className='grid grid-cols-2 gap-3'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='wifi-001'
                      autoComplete='off'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input placeholder='••••' autoComplete='off' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Profile */}
          <FormField
            control={form.control}
            name='profile'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profile</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select a profile' />
                    </SelectTrigger>
                  </FormControl>
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
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Server */}
          <FormField
            control={form.control}
            name='server'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Server</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SERVERS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* MAC Address */}
          <FormField
            control={form.control}
            name='mac_address'
            render={({ field }) => (
              <FormItem>
                <FormLabel>MAC Address</FormLabel>
                <FormControl>
                  <Input
                    placeholder='AA:BB:CC:DD:EE:FF'
                    {...field}
                    onChange={(e) =>
                      field.onChange(e.target.value.toUpperCase())
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Status */}
          <FormField
            control={form.control}
            name='disabled'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='false'>Enabled</SelectItem>
                    <SelectItem value='true'>Disabled</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Comment */}
          <FormField
            control={form.control}
            name='comment'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Comment</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='Catatan opsional...'
                    className='resize-none'
                    rows={2}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>

      <SheetFooter className='border-t px-6 py-4'>
        <SheetClose asChild>
          <Button variant='outline' size='sm' disabled={isPending}>
            Cancel
          </Button>
        </SheetClose>
        <Button
          type='submit'
          size='sm'
          form='hotspot-user-form'
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
