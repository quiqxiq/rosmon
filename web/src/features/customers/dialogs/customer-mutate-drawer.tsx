import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, ChevronRight, Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { parseAPIError } from '@/lib/api/errors'
import { useRouters } from '@/features/routers/api/queries'
import { usePPPDbProfiles } from '@/features/ppp/billing/api/queries'
import { useHotspotDbProfiles } from '@/features/hotspot/billing/api/queries'
import { useCreateSubscription } from '@/features/subscriptions/api/queries'
import type { SubscriptionCreateInput } from '@/features/subscriptions/api/schema'
import { useCreateCustomer, useUpdateCustomer } from '../api/queries'
import {
  type Customer,
  type CustomerCreateInput,
  type CustomerStatus,
} from '../api/schema'
import { useCustomersDialogStore } from '../store/customers-dialog-store'

// ── Schemas ──────────────────────────────────────────────────────────────────

const customerSchema = z.object({
  full_name: z.string().min(1, 'Nama wajib diisi'),
  phone: z.string().min(1, 'Nomor telepon wajib diisi'),
  area: z.string(),
  address: z.string(),
  notes: z.string(),
  status: z.enum(['aktif', 'nonaktif']),
})
type CustomerFormValues = z.infer<typeof customerSchema>

const subscriptionSchema = z.object({
  device_id: z.string().min(1, 'Pilih device terlebih dahulu'),
  service_type: z.enum(['pppoe', 'hotspot']),
  profile_id: z.string().min(1, 'Pilih paket terlebih dahulu'),
  mikrotik_username: z.string().min(1, 'Username wajib diisi'),
  mikrotik_password: z.string().min(1, 'Password wajib diisi'),
})
type SubscriptionFormValues = z.infer<typeof subscriptionSchema>

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultCustomer(target?: Customer | null): CustomerFormValues {
  return {
    full_name: target?.full_name ?? '',
    phone: target?.phone ?? '',
    area: target?.area ?? '',
    address: target?.address ?? '',
    notes: target?.notes ?? '',
    status: (target?.status as CustomerStatus) ?? 'aktif',
  }
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className='flex items-center gap-2 text-sm'>
      <div
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-xs font-bold transition-colors',
          step === 1
            ? 'bg-primary text-primary-foreground'
            : 'bg-green-500 text-white',
        )}
      >
        {step === 1 ? '1' : <CheckCircle2 className='size-3.5' />}
      </div>
      <span className={cn('font-medium', step > 1 && 'text-muted-foreground')}>
        Informasi Customer
      </span>
      <ChevronRight className='size-4 text-muted-foreground' />
      <div
        className={cn(
          'flex size-6 items-center justify-center rounded-full text-xs font-bold transition-colors',
          step === 2
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground',
        )}
      >
        2
      </div>
      <span
        className={cn(
          'font-medium',
          step < 2 && 'text-muted-foreground',
        )}
      >
        Buat Subscription
      </span>
    </div>
  )
}

// ── Root ─────────────────────────────────────────────────────────────────────

export function CustomerMutateDrawer() {
  const { mode, target, close } = useCustomersDialogStore()
  const isOpen = mode === 'add' || mode === 'edit'
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && (
        <CustomerForm
          key={target?.id ?? `add-${mode}`}
          mode={mode === 'edit' ? 'edit' : 'add'}
          target={target}
          onClose={close}
        />
      )}
    </Sheet>
  )
}

// ── Customer Form (Step 1) ────────────────────────────────────────────────────

type CustomerFormProps = {
  mode: 'add' | 'edit'
  target: Customer | null
  onClose: () => void
}

function CustomerForm({ mode, target, onClose }: CustomerFormProps) {
  const createMutation = useCreateCustomer()
  const updateMutation = useUpdateCustomer()

  // Multi-step state — only relevant for 'add' mode
  const [step, setStep] = useState<1 | 2>(1)
  const [createdCustomer, setCreatedCustomer] = useState<Customer | null>(null)

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: defaultCustomer(mode === 'edit' ? target : null),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const onSubmit = (values: CustomerFormValues) => {
    const payload: CustomerCreateInput = {
      full_name: values.full_name.trim(),
      phone: values.phone.trim(),
      address: values.address.trim(),
      area: values.area.trim(),
      notes: values.notes.trim(),
      status: values.status,
    }

    if (mode === 'edit') {
      if (!target) return
      updateMutation.mutate(
        { id: target.id, payload },
        {
          onSuccess: () => {
            toast.success(`Customer '${values.full_name}' diperbarui`)
            onClose()
          },
          onError: (err) =>
            toast.error('Gagal memperbarui customer', {
              description: parseAPIError(err),
            }),
        },
      )
      return
    }

    // mode === 'add' — go to step 2 on success
    createMutation.mutate(payload, {
      onSuccess: (created) => {
        toast.success(`Customer '${created.full_name}' berhasil dibuat`)
        setCreatedCustomer(created)
        setStep(2)
      },
      onError: (err) =>
        toast.error('Gagal membuat customer', {
          description: parseAPIError(err),
        }),
    })
  }

  // Step 2: Subscription form
  if (step === 2 && createdCustomer) {
    return (
      <SubscriptionStep
        customer={createdCustomer}
        onSkip={onClose}
        onDone={onClose}
      />
    )
  }

  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
      <SheetHeader className='border-b px-6 py-4'>
        <SheetTitle>
          {mode === 'add' ? 'Add Customer' : 'Edit Customer'}
        </SheetTitle>
        {mode === 'add' && (
          <div className='pt-1'>
            <StepIndicator step={1} />
          </div>
        )}
        {mode === 'edit' && (
          <SheetDescription>
            Update data kontak dan status pelanggan.
          </SheetDescription>
        )}
      </SheetHeader>

      <Form {...form}>
        <form
          id='customer-form'
          className='flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5'
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            control={form.control}
            name='full_name'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input placeholder='Budi Santoso' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='phone'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder='0812xxxxxxx' type='tel' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='area'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Area</FormLabel>
                <FormControl>
                  <Input placeholder='Blok A' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='address'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Textarea className='resize-none' rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='notes'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl>
                  <Textarea className='resize-none' rows={2} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='status'
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
                    <SelectItem value='aktif'>Aktif</SelectItem>
                    <SelectItem value='nonaktif'>Nonaktif</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>

      <SheetFooter className='border-t px-6 py-4'>
        <Button
          variant='outline'
          size='sm'
          disabled={isPending}
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type='submit'
          size='sm'
          form='customer-form'
          disabled={isPending}
          className='gap-1.5'
        >
          {isPending && <Loader2 className='size-4 animate-spin' />}
          {mode === 'add' ? (
            <>
              Buat Customer
              <ChevronRight className='size-4' />
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </SheetFooter>
    </SheetContent>
  )
}

// ── Subscription Step (Step 2) ────────────────────────────────────────────────

type SubscriptionStepProps = {
  customer: Customer
  onSkip: () => void
  onDone: () => void
}

function SubscriptionStep({ customer, onSkip, onDone }: SubscriptionStepProps) {
  const routersQuery = useRouters()
  const createSubMutation = useCreateSubscription()

  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      device_id: '',
      service_type: 'pppoe',
      profile_id: '',
      mikrotik_username: '',
      mikrotik_password: '',
    },
  })

  const isPending = createSubMutation.isPending
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
    if (serviceType === 'pppoe') {
      return (pppProfiles.data ?? []).map((p) => ({
        value: String(p.id),
        label: p.name,
        sub: p.rate_limit,
      }))
    }
    return (hotspotProfiles.data ?? []).map((p) => ({
      value: String(p.id),
      label: p.name,
      sub: '',
    }))
  }, [serviceType, pppProfiles.data, hotspotProfiles.data])

  const onSubmit = (values: SubscriptionFormValues) => {
    const profileId = Number(values.profile_id) || undefined
    const payload: SubscriptionCreateInput = {
      customer_id: customer.id,
      device_id: Number(values.device_id),
      service_type: values.service_type,
      mikrotik_username: values.mikrotik_username.trim(),
      mikrotik_password: values.mikrotik_password,
      ...(values.service_type === 'pppoe'
        ? { ppp_profile_id: profileId }
        : { hotspot_profile_id: profileId }),
    }

    createSubMutation.mutate(payload, {
      onSuccess: (res) => {
        toast.success('Subscription berhasil dibuat', {
          description: res.warning,
        })
        onDone()
      },
      onError: (err) =>
        toast.error('Gagal membuat subscription', {
          description: parseAPIError(err),
        }),
    })
  }

  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
      <SheetHeader className='border-b px-6 py-4'>
        <SheetTitle>Buat Subscription</SheetTitle>
        <div className='pt-1'>
          <StepIndicator step={2} />
        </div>
      </SheetHeader>

      {/* Customer badge */}
      <div className='flex items-center gap-2 border-b bg-muted/30 px-6 py-3'>
        <UserPlus className='size-4 text-green-500' />
        <span className='text-sm text-muted-foreground'>Customer:</span>
        <Badge variant='secondary' className='font-semibold'>
          {customer.full_name}
        </Badge>
        <span className='text-xs text-muted-foreground'>{customer.phone}</span>
      </div>

      <Form {...form}>
        <form
          id='subscription-step-form'
          className='flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5'
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {/* Device */}
          <FormField
            control={form.control}
            name='device_id'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Device / Router</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select a router' />
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
                          deviceId === 0
                            ? 'Pilih device terlebih dahulu'
                            : 'Pilih paket'
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {profileOptions.length === 0 ? (
                      <SelectItem value='__none' disabled>
                        {deviceId === 0
                          ? 'Pilih device terlebih dahulu'
                          : 'Belum ada profile untuk device ini'}
                      </SelectItem>
                    ) : (
                      profileOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          <span className='flex items-center gap-2'>
                            <span>{o.label}</span>
                            {o.sub && (
                              <span className='text-xs text-muted-foreground'>
                                {o.sub}
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <Separator />

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
                  <FormLabel>MikroTik Password</FormLabel>
                  <FormControl>
                    <Input autoComplete='off' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>

      <SheetFooter className='border-t px-6 py-4'>
        <Button
          variant='outline'
          size='sm'
          disabled={isPending}
          onClick={onSkip}
        >
          Lewati
        </Button>
        <Button
          type='submit'
          size='sm'
          form='subscription-step-form'
          disabled={isPending}
          className='gap-1.5'
        >
          {isPending && <Loader2 className='size-4 animate-spin' />}
          Buat Subscription
        </Button>
      </SheetFooter>
    </SheetContent>
  )
}
