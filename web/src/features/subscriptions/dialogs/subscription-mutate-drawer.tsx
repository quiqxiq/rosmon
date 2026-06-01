import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { useCustomers } from '@/features/customers/api/queries'
import { useRouters } from '@/features/routers/api/queries'
import { usePPPDbProfiles } from '@/features/ppp/billing/api/queries'
import { useHotspotDbProfiles } from '@/features/hotspot/billing/api/queries'
import {
  useCreateSubscription,
  useUpdateSubscription,
} from '../api/queries'
import {
  type ServiceType,
  type Subscription,
  type SubscriptionCreateInput,
} from '../api/schema'
import { useSubscriptionsDialogStore } from '../store/dialog-store'

// ── Schema ──────────────────────────────────────────────────────────────────

const baseSchema = z.object({
  customer_id: z.string(),
  device_id: z.string(),
  service_type: z.enum(['pppoe', 'hotspot']),
  profile_id: z.string(),
  mikrotik_username: z.string(),
  mikrotik_password: z.string(),
  billing_day: z.string(),
  notes: z.string(),
})

const addSchema = baseSchema.extend({
  customer_id: z.string().min(1, 'Customer wajib dipilih'),
  device_id: z.string().min(1, 'Device wajib dipilih'),
  mikrotik_username: z.string().min(1, 'Username wajib diisi'),
  mikrotik_password: z.string().min(1, 'Password wajib diisi'),
})

type SubscriptionFormValues = z.infer<typeof baseSchema>

function defaultValues(target?: Subscription | null): SubscriptionFormValues {
  return {
    customer_id: target ? String(target.customer_id) : '',
    device_id: target ? String(target.device_id) : '',
    service_type: (target?.service_type as ServiceType) ?? 'pppoe',
    profile_id: target
      ? String(target.ppp_profile_id ?? target.hotspot_profile_id ?? '')
      : '',
    mikrotik_username: target?.mikrotik_username ?? '',
    mikrotik_password: '',
    billing_day: target?.billing_day ? String(target.billing_day) : '',
    notes: target?.notes ?? '',
  }
}

// ── Root ─────────────────────────────────────────────────────────────────────

export function SubscriptionMutateDrawer() {
  const { mode, target, close } = useSubscriptionsDialogStore()
  const isOpen = mode === 'add' || mode === 'edit'
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && (
        <SubscriptionForm
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

type SubscriptionFormProps = {
  mode: 'add' | 'edit'
  target: Subscription | null
  onClose: () => void
}

function SubscriptionForm({ mode, target, onClose }: SubscriptionFormProps) {
  const customersQuery = useCustomers()
  const routersQuery = useRouters()
  const createMutation = useCreateSubscription()
  const updateMutation = useUpdateSubscription()

  const isEdit = mode === 'edit'
  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(isEdit ? baseSchema : addSchema),
    defaultValues: defaultValues(isEdit ? target : null),
  })

  const isPending = createMutation.isPending || updateMutation.isPending
  const deviceId = Number(form.watch('device_id')) || 0
  const serviceType = form.watch('service_type')

  const pppProfiles = usePPPDbProfiles(
    serviceType === 'pppoe' ? deviceId : 0,
  )
  const hotspotProfiles = useHotspotDbProfiles(
    serviceType === 'hotspot' ? deviceId : 0,
    { role: 'permanent' },
  )

  const profileOptions = useMemo(() => {
    if (serviceType === 'pppoe')
      return (pppProfiles.data ?? []).map((p) => ({
        value: String(p.id),
        label: p.name,
      }))
    return (hotspotProfiles.data ?? []).map((p) => ({
      value: String(p.id),
      label: p.name,
    }))
  }, [serviceType, pppProfiles.data, hotspotProfiles.data])

  const onSubmit = (values: SubscriptionFormValues) => {
    if (mode === 'add') {
      const profileId = Number(values.profile_id) || undefined
      const payload: SubscriptionCreateInput = {
        customer_id: Number(values.customer_id),
        device_id: Number(values.device_id),
        service_type: values.service_type,
        mikrotik_username: values.mikrotik_username.trim(),
        mikrotik_password: values.mikrotik_password,
        billing_day: values.billing_day ? Number(values.billing_day) : undefined,
        notes: values.notes.trim() || undefined,
        ...(values.service_type === 'pppoe'
          ? { ppp_profile_id: profileId }
          : { hotspot_profile_id: profileId }),
      }
      createMutation.mutate(payload, {
        onSuccess: (res) => {
          toast.success('Subscription dibuat', { description: res.warning })
          onClose()
        },
        onError: (err) =>
          toast.error('Gagal membuat subscription', {
            description: parseAPIError(err),
          }),
      })
      return
    }

    if (!target) return
    const profileId = Number(values.profile_id) || undefined
    updateMutation.mutate(
      {
        id: target.id,
        payload: {
          notes: values.notes.trim(),
          mikrotik_password: values.mikrotik_password.trim() || undefined,
          ...(target.service_type === 'pppoe'
            ? { ppp_profile_id: profileId }
            : { hotspot_profile_id: profileId }),
        },
      },
      {
        onSuccess: (res) => {
          toast.success('Subscription diperbarui', { description: res.warning })
          onClose()
        },
        onError: (err) =>
          toast.error('Gagal memperbarui subscription', {
            description: parseAPIError(err),
          }),
      },
    )
  }

  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
      <SheetHeader className='border-b px-6 py-4'>
        <SheetTitle>
          {isEdit ? 'Edit Subscription' : 'New Subscription'}
        </SheetTitle>
        <SheetDescription>
          Links a customer to a device profile and provisions the MikroTik
          secret/user.
        </SheetDescription>
      </SheetHeader>

      <Form {...form}>
        <form
          id='subscription-form'
          className='flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5'
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {/* Customer */}
          <FormField
            control={form.control}
            name='customer_id'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isEdit}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select customer' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(customersQuery.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Device */}
          <FormField
            control={form.control}
            name='device_id'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Device</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={isEdit}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select device' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(routersQuery.data ?? []).map((r) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Service Type */}
          <FormField
            control={form.control}
            name='service_type'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Type</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v)
                    form.setValue('profile_id', '')
                  }}
                  disabled={isEdit}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='pppoe'>PPPoE</SelectItem>
                    <SelectItem value='hotspot'>Hotspot</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Billing Profile */}
          <FormField
            control={form.control}
            name='profile_id'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Billing Profile</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={deviceId === 0}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          deviceId === 0 ? 'Select a device first' : 'Select profile'
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {profileOptions.length === 0 ? (
                      <SelectItem value='__none' disabled>
                        No profiles for this device
                      </SelectItem>
                    ) : (
                      profileOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Username + Password */}
          <div className='grid grid-cols-2 gap-3'>
            <FormField
              control={form.control}
              name='mikrotik_username'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>MikroTik Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='pppoe-budi'
                      disabled={isEdit}
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
              name='mikrotik_password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isEdit ? 'Password (blank = keep)' : 'MikroTik Password'}
                  </FormLabel>
                  <FormControl>
                    <Input placeholder='••••' autoComplete='off' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Billing Day — hanya saat create */}
          {!isEdit && (
            <FormField
              control={form.control}
              name='billing_day'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Tanggal Tagih
                    <span className='ml-1 text-muted-foreground text-xs'>
                      (1–28, opsional)
                    </span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      max={28}
                      placeholder='Kosong = default global'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* Notes */}
          <FormField
            control={form.control}
            name='notes'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea
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
          form='subscription-form'
          disabled={isPending}
          className='gap-1.5'
        >
          {isPending && <Loader2 className='size-4 animate-spin' />}
          {isEdit ? 'Save Changes' : 'Create'}
        </Button>
      </SheetFooter>
    </SheetContent>
  )
}
