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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { InputCombobox } from '@/components/input-combobox'
import { parseAPIError } from '@/lib/api/errors'
import { usePools } from '@/features/network/api/queries'
import {
  useCreateHotspotDbProfile,
  useUpdateHotspotDbProfile,
} from '../api/queries'
import {
  type ExpiryMode,
  type HotspotDbProfile,
  type HotspotRole,
} from '../api/schema'
import { useHotspotBillingDialogStore } from '../store/dialog-store'

const EXPIRY_MODES: { value: ExpiryMode; label: string }[] = [
  { value: '0', label: 'No expiry' },
  { value: 'rem', label: 'Remove on expiry' },
  { value: 'ntf', label: 'Notify on expiry' },
  { value: 'remc', label: 'Remove + record' },
  { value: 'ntfc', label: 'Notify + record' },
]

// ── Schema ──────────────────────────────────────────────────────────────────

const hsDbProfileSchema = z.object({
  name: z.string(),
  role: z.string(),
  rate_limit: z.string(),
  address_pool: z.string(),
  shared_users: z.string(),
  status_autorefresh: z.string(),
  parent_queue: z.string(),
  description: z.string(),
  active: z.enum(['true', 'false']),
  // permanent fields
  price_monthly: z.string(),
  is_public: z.boolean(),
  // voucher fields
  expiry_mode: z.string(),
  validity: z.string(),
  price: z.string(),
  sell_price: z.string(),
  lock_mac: z.enum(['true', 'false']),
})

const addSchema = hsDbProfileSchema.extend({
  name: z.string().min(1, 'Name wajib diisi'),
})

type HsDbProfileFormValues = z.infer<typeof hsDbProfileSchema>

function defaultValues(target?: HotspotDbProfile | null): HsDbProfileFormValues {
  return {
    name: target?.name ?? '',
    role: target?.role ?? 'voucher',
    rate_limit: target?.rate_limit ?? '',
    address_pool: target?.address_pool ?? '',
    shared_users: target?.shared_users ? String(target.shared_users) : '1',
    status_autorefresh: target?.status_autorefresh ?? '1m',
    parent_queue: target?.parent_queue ?? '',
    description: target?.description ?? '',
    active: target?.active ? 'true' : 'false',
    // permanent
    price_monthly: target?.price_monthly ? String(target.price_monthly) : '',
    is_public: target?.is_public ?? false,
    // voucher
    expiry_mode: (target?.expiry_mode as ExpiryMode) ?? '0',
    validity: target?.validity ?? '',
    price: target?.price ? String(target.price) : '',
    sell_price: target?.sell_price ? String(target.sell_price) : '',
    lock_mac: target?.lock_mac ? 'true' : 'false',
  }
}

// ── Root ─────────────────────────────────────────────────────────────────────

export function HotspotBillingMutateDrawer() {
  const { mode, target, close } = useHotspotBillingDialogStore()
  const isOpen = mode === 'add' || mode === 'edit'
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && (
        <HsDbProfileForm
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

type HsDbProfileFormProps = {
  mode: 'add' | 'edit'
  target: HotspotDbProfile | null
  onClose: () => void
}

function HsDbProfileForm({ mode, target, onClose }: HsDbProfileFormProps) {
  const routerId = useActiveRouterId() ?? 0
  const createMutation = useCreateHotspotDbProfile(routerId)
  const updateMutation = useUpdateHotspotDbProfile(routerId)

  const { data: pools, isLoading: poolsLoading } = usePools(routerId)
  const addressPoolOptions = useMemo(
    () => (pools ?? []).map((p) => ({ label: p.name, value: p.name })),
    [pools],
  )

  const isEdit = mode === 'edit'
  const form = useForm<HsDbProfileFormValues>({
    resolver: zodResolver(isEdit ? hsDbProfileSchema : addSchema),
    defaultValues: defaultValues(isEdit ? target : null),
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const role = form.watch('role') as HotspotRole

  const num = (s: string) => {
    const n = Number(s)
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
  }

  const onSubmit = (values: HsDbProfileFormValues) => {
    const mikrotik = {
      rate_limit: values.rate_limit.trim(),
      address_pool: values.address_pool.trim(),
      shared_users: num(values.shared_users) || 1,
      status_autorefresh: values.status_autorefresh.trim() || '1m',
      parent_queue: values.parent_queue.trim(),
      description: values.description.trim(),
      active: values.active === 'true',
    }
    const billing =
      values.role === 'permanent'
        ? { price_monthly: num(values.price_monthly), is_public: values.is_public }
        : {
            expiry_mode: values.expiry_mode as ExpiryMode,
            validity: values.validity.trim(),
            price: num(values.price),
            sell_price: num(values.sell_price),
            lock_mac: values.lock_mac === 'true',
          }

    if (mode === 'add') {
      createMutation.mutate(
        {
          name: values.name.trim(),
          role: values.role as HotspotRole,
          ...mikrotik,
          ...billing,
        },
        {
          onSuccess: (res) => {
            toast.success(`Profile '${values.name}' dibuat`, {
              description: res.warning,
            })
            onClose()
          },
          onError: (err) =>
            toast.error('Gagal membuat profile', {
              description: parseAPIError(err),
            }),
        },
      )
      return
    }

    if (!target) return
    updateMutation.mutate(
      { id: target.id, payload: { ...mikrotik, ...billing } },
      {
        onSuccess: (res) => {
          toast.success(`Profile '${values.name}' diperbarui`, {
            description: res.warning,
          })
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
          {mode === 'add' ? 'Add Hotspot Profile' : 'Edit Hotspot Profile'}
        </SheetTitle>
        <SheetDescription>
          DB-backed hotspot plan · synced to RouterOS best-effort
        </SheetDescription>
      </SheetHeader>

      <Form {...form}>
        <form
          id='hs-db-profile-form'
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
                    placeholder='1day'
                    disabled={isEdit}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Role */}
          <FormField
            control={form.control}
            name='role'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isEdit}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='voucher'>Voucher</SelectItem>
                    <SelectItem value='permanent'>Permanent</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Rate Limit */}
          <FormField
            control={form.control}
            name='rate_limit'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rate Limit (rx/tx)</FormLabel>
                <FormControl>
                  <Input placeholder='5M/5M' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Role-conditional fields */}
          {role === 'permanent' ? (
            <>
              <FormField
                control={form.control}
                name='price_monthly'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price / bulan (IDR)</FormLabel>
                    <FormControl>
                      <Input type='number' min='0' placeholder='100000' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='is_public'
                render={({ field }) => (
                  <FormItem className='flex items-center justify-between rounded-md border px-3 py-2'>
                    <div>
                      <FormLabel className='text-sm font-medium'>
                        Public package
                      </FormLabel>
                      <FormDescription>
                        Show on the public registration page.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </>
          ) : (
            <>
              <FormField
                control={form.control}
                name='expiry_mode'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Mode</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXPIRY_MODES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>
                            {m.label}
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
                name='validity'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Validity</FormLabel>
                    <FormControl>
                      <Input placeholder='1d' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className='grid grid-cols-2 gap-3'>
                <FormField
                  control={form.control}
                  name='price'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cost (IDR)</FormLabel>
                      <FormControl>
                        <Input type='number' min='0' placeholder='3000' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='sell_price'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sell Price (IDR)</FormLabel>
                      <FormControl>
                        <Input type='number' min='0' placeholder='5000' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name='lock_mac'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lock to MAC</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='false'>No</SelectItem>
                        <SelectItem value='true'>Yes</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {/* Address Pool + Shared Users */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0'>
            <FormField
              control={form.control}
              name='address_pool'
              render={({ field }) => (
                <FormItem className='min-w-0'>
                  <FormLabel>Address Pool</FormLabel>
                  <FormControl>
                    <InputCombobox
                      options={addressPoolOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder='hs-pool'
                      isLoading={poolsLoading}
                      className='w-full min-w-0'
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='shared_users'
              render={({ field }) => (
                <FormItem className='min-w-0'>
                  <FormLabel>Shared Users</FormLabel>
                  <FormControl>
                    <Input type='number' min='1' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Status Autorefresh + Parent Queue */}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 min-w-0'>
            <FormField
              control={form.control}
              name='status_autorefresh'
              render={({ field }) => (
                <FormItem className='min-w-0'>
                  <FormLabel>Status Autorefresh</FormLabel>
                  <FormControl>
                    <Input placeholder='1m' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='parent_queue'
              render={({ field }) => (
                <FormItem className='min-w-0'>
                  <FormLabel>Parent Queue</FormLabel>
                  <FormControl>
                    <Input placeholder='queue name' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Description */}
          <FormField
            control={form.control}
            name='description'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='1 day voucher'
                    className='resize-none'
                    rows={2}
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
            name='active'
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
                    <SelectItem value='true'>Active</SelectItem>
                    <SelectItem value='false'>Inactive</SelectItem>
                  </SelectContent>
                </Select>
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
          form='hs-db-profile-form'
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
