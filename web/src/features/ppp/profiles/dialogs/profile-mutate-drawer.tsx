import { useMemo } from 'react'
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
  FormDescription,
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
import { parseAPIError } from '@/lib/api/errors'
import { usePools } from '@/features/network/api/queries'
import { useAddPPPProfile, useUpdatePPPProfile } from '../api/queries'
import {
  type RouterPPPProfile,
  type RouterPPPProfileCreateInput,
  type RouterPPPProfileUpdateInput,
} from '../api/schema'
import { useProfilesDialogStore } from '../store/profiles-dialog-store'
import { InputCombobox } from '@/components/input-combobox'

// ── Zod schema ──────────────────────────────────────────────────────────────

const profileFormSchema = z.object({
  name: z.string().min(1, 'Name wajib diisi'),
  rate_limit: z.string().optional(),
  local_address: z.string().optional(),
  remote_address: z.string().optional(),
  session_timeout: z.string().optional(),
  idle_timeout: z.string().optional(),
  parent_queue: z.string().optional(),
  comment: z.string().optional(),
  disabled: z.enum(['true', 'false']),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

// ── Helpers ─────────────────────────────────────────────────────────────────

function defaultValues(target?: RouterPPPProfile | null): ProfileFormValues {
  return {
    name: target?.name ?? '',
    rate_limit: target?.rate_limit ?? '',
    local_address: target?.local_address ?? '',
    remote_address: target?.remote_address ?? '',
    session_timeout: target?.session_timeout ?? '',
    idle_timeout: target?.idle_timeout ?? '',
    parent_queue: target?.parent_queue ?? '',
    comment: target?.comment ?? '',
    disabled: target?.disabled ? 'true' : 'false',
  }
}

// ── Root component (controls Sheet open/close) ───────────────────────────────

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

// ── Form component ───────────────────────────────────────────────────────────

type ProfileFormProps = {
  mode: 'add' | 'edit'
  target: RouterPPPProfile | null
  onClose: () => void
}

function ProfileForm({ mode, target, onClose }: ProfileFormProps) {
  const routerId = useActiveRouterId() ?? 0
  const addMutation = useAddPPPProfile(routerId)
  const updateMutation = useUpdatePPPProfile(routerId)

  // Fetch IP pools for address combobox options.
  const { data: pools, isLoading: poolsLoading } = usePools(routerId)

  // Build combobox options from pool list — value = pool name (what MikroTik expects).
  const addressPoolOptions = useMemo(
    () => [
      { label: '(Tanpa Pool / None)', value: '' },
      ...(pools ?? []).map((p) => ({
        label: p.name,
        value: p.name,
      })),
    ],
    [pools],
  )

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: defaultValues(mode === 'edit' ? target : null),
  })

  const isPending = addMutation.isPending || updateMutation.isPending

  const onSubmit = (values: ProfileFormValues) => {
    const common = {
      local_address: values.local_address?.trim() ?? '',
      remote_address: values.remote_address?.trim() ?? '',
      rate_limit: values.rate_limit?.trim() || undefined,
      session_timeout: values.session_timeout?.trim() || undefined,
      idle_timeout: values.idle_timeout?.trim() || undefined,
      parent_queue: values.parent_queue?.trim() || undefined,
      comment: values.comment?.trim() || undefined,
      disabled: values.disabled === 'true',
    }

    if (mode === 'add') {
      const payload: RouterPPPProfileCreateInput = {
        name: values.name.trim(),
        ...common,
      }
      addMutation.mutate(payload, {
        onSuccess: () => {
          toast.success(`Profile '${values.name}' berhasil ditambahkan`)
          onClose()
        },
        onError: (err) =>
          toast.error('Gagal menambahkan profile', {
            description: parseAPIError(err),
          }),
      })
      return
    }

    if (!target) return
    const patch: RouterPPPProfileUpdateInput = {
      name: values.name.trim(),
      ...common,
    }
    updateMutation.mutate(
      { id: target.id, patch },
      {
        onSuccess: () => {
          toast.success(`Profile '${values.name}' berhasil diperbarui`)
          onClose()
        },
        onError: (err) =>
          toast.error('Gagal memperbarui profile', {
            description: parseAPIError(err),
          }),
      },
    )
  }

  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
      <SheetHeader className='border-b px-6 py-4'>
        <SheetTitle>
          {mode === 'add' ? 'Tambah PPP Profile' : 'Edit PPP Profile'}
        </SheetTitle>
        <SheetDescription>
          RouterOS /ppp/profile · addresses · rate limit
        </SheetDescription>
      </SheetHeader>

      <Form {...form}>
        <form
          id='ppp-profile-form'
          className='flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5'
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {/* Name */}
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem className='min-w-0'>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder='default'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Rate Limit */}
          <FormField
            control={form.control}
            name='rate_limit'
            render={({ field }) => (
              <FormItem className='min-w-0'>
                <FormLabel>Rate Limit</FormLabel>
                <FormControl>
                  <Input placeholder='10M/10M' autoComplete='off' {...field} />
                </FormControl>
                <FormDescription>
                  Format: rx/tx — contoh 10M/10M atau 5M/2M
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Address row */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0'>
            {/* Local Address */}
            <FormField
              control={form.control}
              name='local_address'
              render={({ field }) => (
                <FormItem className='min-w-0'>
                  <FormLabel>Local Address</FormLabel>
                  <FormControl>
                    <InputCombobox
                      options={addressPoolOptions}
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      placeholder='IP atau pool...'
                      isLoading={poolsLoading}
                      className='w-full min-w-0'
                    />
                  </FormControl>
                  <FormDescription className='text-xs'>
                    IP address gateway
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Remote Address */}
            <FormField
              control={form.control}
              name='remote_address'
              render={({ field }) => (
                <FormItem className='min-w-0'>
                  <FormLabel>Remote Address</FormLabel>
                  <FormControl>
                    <InputCombobox
                      options={addressPoolOptions}
                      value={field.value ?? ''}
                      onValueChange={field.onChange}
                      placeholder='IP atau pool...'
                      isLoading={poolsLoading}
                      className='w-full min-w-0'
                    />
                  </FormControl>
                  <FormDescription className='text-xs'>
                    IP atau nama pool client
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Timeout row */}
          <div className='grid grid-cols-2 gap-3'>
            <FormField
              control={form.control}
              name='session_timeout'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session Timeout</FormLabel>
                  <FormControl>
                    <Input placeholder='1h30m' autoComplete='off' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='idle_timeout'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Idle Timeout</FormLabel>
                  <FormControl>
                    <Input placeholder='10m' autoComplete='off' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Parent Queue */}
          <FormField
            control={form.control}
            name='parent_queue'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parent Queue</FormLabel>
                <FormControl>
                  <Input
                    placeholder='nama queue (opsional)'
                    autoComplete='off'
                    {...field}
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
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
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
            Batal
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
          {mode === 'add' ? 'Tambah Profile' : 'Simpan Perubahan'}
        </Button>
      </SheetFooter>
    </SheetContent>
  )
}
