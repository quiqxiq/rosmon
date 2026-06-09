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
import { InputCombobox } from '@/components/input-combobox'
import { usePools } from '@/features/network/api/queries'
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

// ── Schema ──────────────────────────────────────────────────────────────────

const hotspotProfileSchema = z.object({
  name: z.string(),
  rate_limit: z.string(),
  shared_users: z.string(),
  parent_queue: z.string(),
  address_pool: z.string(),
  validity: z.string(),
  expire_mode: z.string(),
  price: z.string(),
  selling_price: z.string(),
  lock_user: z.string(),
  lock_server: z.string(),
})

const addSchema = hotspotProfileSchema.extend({
  name: z.string().min(1, 'Profile name wajib diisi'),
})

type HotspotProfileFormValues = z.infer<typeof hotspotProfileSchema>

function defaultValues(
  target?: HotspotProfileViewModel | null,
): HotspotProfileFormValues {
  return {
    name: target?.name ?? '',
    rate_limit: target?.rateLimit ?? '1M/1M',
    shared_users: target?.sharedUsers ?? '1',
    parent_queue: target?.parentQueue ?? 'none',
    address_pool: target?.addressPool ?? '',
    validity: target?.validity ?? '1h',
    expire_mode: target?.expMode ?? 'rem',
    price: target?.price != null ? String(target.price) : '0',
    selling_price: target?.sellingPrice != null ? String(target.sellingPrice) : '0',
    lock_user: target?.lockUser ? 'enable' : 'disable',
    lock_server: target?.lockServer ? 'enable' : 'disable',
  }
}

// ── Root ─────────────────────────────────────────────────────────────────────

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

// ── Form ─────────────────────────────────────────────────────────────────────

type ProfileFormProps = {
  mode: 'add' | 'edit'
  target: HotspotProfileViewModel | null
  onClose: () => void
}

function ProfileForm({ mode, target, onClose }: ProfileFormProps) {
  const routerId = useActiveRouterId() ?? 0
  const addMutation = useAddHotspotProfile(routerId)
  const updateMutation = useUpdateHotspotProfile(routerId)

  const { data: pools, isLoading: poolsLoading } = usePools(routerId)
  const addressPoolOptions = useMemo(
    () => (pools ?? []).map((p) => ({ label: p.name, value: p.name })),
    [pools],
  )

  const isEdit = mode === 'edit'
  const form = useForm<HotspotProfileFormValues>({
    resolver: zodResolver(isEdit ? hotspotProfileSchema : addSchema),
    defaultValues: defaultValues(isEdit ? target : null),
  })

  const isPending = addMutation.isPending || updateMutation.isPending

  const toNum = (s: string) => Math.max(0, +s || 0)

  const onSubmit = (values: HotspotProfileFormValues) => {
    const payload: HotspotProfileParams = {
      name: values.name.trim(),
      rate_limit: values.rate_limit || undefined,
      shared_users: values.shared_users || undefined,
      parent_queue: values.parent_queue || undefined,
      address_pool: values.address_pool || undefined,
      validity: values.validity || undefined,
      expire_mode: values.expire_mode || undefined,
      price: toNum(values.price),
      selling_price: toNum(values.selling_price),
      lock_user: values.lock_user || undefined,
      lock_server: values.lock_server || undefined,
    }

    if (mode === 'add') {
      addMutation.mutate(payload, {
        onSuccess: () => {
          toast.success(`Profile '${values.name}' ditambahkan`)
          onClose()
        },
        onError: (err) =>
          toast.error('Gagal menambahkan profile', {
            description: err instanceof Error ? err.message : String(err),
          }),
      })
    } else if (target) {
      updateMutation.mutate(
        { id: target.id, params: payload },
        {
          onSuccess: () => {
            toast.success(`Profile '${values.name}' diperbarui`)
            onClose()
          },
          onError: (err) =>
            toast.error('Gagal memperbarui profile', {
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
          {mode === 'add' ? 'Add Profile' : 'Edit Profile'}
        </SheetTitle>
        <SheetDescription>
          Hotspot user profile · pricing · rate-limit
        </SheetDescription>
      </SheetHeader>

      <Form {...form}>
        <form
          id='hotspot-profile-form'
          className='flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5'
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {/* Name */}
          <FormField
            control={form.control}
            name='name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder='1jam-1k'
                    autoComplete='off'
                    disabled={isEdit}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Rate Limit + Validity */}
          <div className='grid grid-cols-2 gap-3'>
            <FormField
              control={form.control}
              name='rate_limit'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate Limit</FormLabel>
                  <FormControl>
                    <Input placeholder='1M/1M' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='validity'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Validity</FormLabel>
                  <FormControl>
                    <Input placeholder='1h, 1d, 7d, 30d' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Price + Selling Price */}
          <div className='grid grid-cols-2 gap-3'>
            <FormField
              control={form.control}
              name='price'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price</FormLabel>
                  <FormControl>
                    <Input type='number' min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='selling_price'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Selling Price</FormLabel>
                  <FormControl>
                    <Input type='number' min={0} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Shared Users + Exp Mode */}
          <div className='grid grid-cols-2 gap-3'>
            <FormField
              control={form.control}
              name='shared_users'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shared Users</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SHARED_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='expire_mode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exp Mode</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {expModeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Address Pool + Parent Queue */}
          <div className='grid grid-cols-2 gap-3'>
            <FormField
              control={form.control}
              name='address_pool'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address Pool</FormLabel>
                  <FormControl>
                    <InputCombobox
                      options={addressPoolOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder='Pilih atau ketik pool'
                      isLoading={poolsLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='parent_queue'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Parent Queue</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PARENT_QUEUE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>
                          {opt}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Lock User + Lock Server */}
          <div className='grid grid-cols-2 gap-3'>
            <FormField
              control={form.control}
              name='lock_user'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lock User</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='enable'>Enable</SelectItem>
                      <SelectItem value='disable'>Disable</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='lock_server'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lock Server</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='enable'>Enable</SelectItem>
                      <SelectItem value='disable'>Disable</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
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
          form='hotspot-profile-form'
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
