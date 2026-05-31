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
import { useRouters } from '@/features/routers/api/queries'
import { usePPPDbProfiles } from '@/features/ppp/billing/api/queries'
import { useHotspotDbProfiles } from '@/features/hotspot/billing/api/queries'
import { useCompleteInstall } from '../api/queries'
import { type CompleteInstallInput, type Registration } from '../api/schema'
import { useRegistrationsDialogStore } from '../store/dialog-store'

// ── Schema ──────────────────────────────────────────────────────────────────

const installFormSchema = z.object({
  device_id: z.string().min(1, 'Pilih device terlebih dahulu'),
  service_type: z.enum(['pppoe', 'hotspot']),
  profile_id: z.string().min(1, 'Pilih paket terlebih dahulu'),
  mikrotik_username: z.string().min(1, 'Username wajib diisi'),
  mikrotik_password: z.string().min(1, 'Password wajib diisi'),
  billing_day: z.string(),
})

type InstallFormValues = z.infer<typeof installFormSchema>

// ── Root ─────────────────────────────────────────────────────────────────────

export function CompleteInstallDrawer() {
  const { mode, target, close } = useRegistrationsDialogStore()
  const isOpen = mode === 'complete'
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && target && (
        <InstallForm key={target.id} target={target} onClose={close} />
      )}
    </Sheet>
  )
}

// ── Form ─────────────────────────────────────────────────────────────────────

type InstallFormProps = {
  target: Registration
  onClose: () => void
}

function InstallForm({ target, onClose }: InstallFormProps) {
  const mut = useCompleteInstall()
  const routersQuery = useRouters()

  const defaultServiceType =
    target.service_type === 'hotspot' ? 'hotspot' : 'pppoe'

  const form = useForm<InstallFormValues>({
    resolver: zodResolver(installFormSchema),
    defaultValues: {
      device_id: target.device_id ? String(target.device_id) : '',
      service_type: defaultServiceType,
      profile_id:
        defaultServiceType === 'pppoe'
          ? target.ppp_profile_id
            ? String(target.ppp_profile_id)
            : ''
          : target.hotspot_profile_id
            ? String(target.hotspot_profile_id)
            : '',
      mikrotik_username: '',
      mikrotik_password: '',
      billing_day: '',
    },
  })

  const isPending = mut.isPending
  const deviceId = Number(form.watch('device_id')) || 0
  const serviceType = form.watch('service_type')

  const pppProfiles = usePPPDbProfiles(deviceId)
  const hsProfiles = useHotspotDbProfiles(deviceId)
  const hotspotPermanent = useMemo(
    () => (hsProfiles.data ?? []).filter((p) => p.role === 'permanent'),
    [hsProfiles.data],
  )

  const onSubmit = (values: InstallFormValues) => {
    const rid = Number(values.device_id)

    const payload: CompleteInstallInput = {
      device_id: rid,
      service_type: values.service_type,
      mikrotik_username: values.mikrotik_username.trim(),
      mikrotik_password: values.mikrotik_password.trim(),
      ...(values.service_type === 'pppoe'
        ? { ppp_profile_id: Number(values.profile_id) }
        : { hotspot_profile_id: Number(values.profile_id) }),
      ...(values.billing_day
        ? { billing_day: Number(values.billing_day) }
        : {}),
    }

    mut.mutate(
      { id: target.id, payload },
      {
        onSuccess: () => {
          toast.success('Installed — subscription + first invoice created')
          onClose()
        },
        onError: (err) =>
          toast.error('Install failed', { description: parseAPIError(err) }),
      },
    )
  }

  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
      <SheetHeader className='border-b px-6 py-4'>
        <SheetTitle>Complete installation</SheetTitle>
        <SheetDescription>
          Provision '{target.full_name}' → creates an active subscription
          (synced to the router) + first invoice.
        </SheetDescription>
      </SheetHeader>

      <Form {...form}>
        <form
          id='complete-install-form'
          className='flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5'
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {/* Device / Router */}
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
                <FormLabel>Service type</FormLabel>
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

          {/* Package */}
          <FormField
            control={form.control}
            name='profile_id'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Package</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!deviceId}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          deviceId ? 'Select a package' : 'Pick a device first'
                        }
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {serviceType === 'pppoe'
                      ? (pppProfiles.data ?? []).map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))
                      : hotspotPermanent.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
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
                      placeholder='budi-001'
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

          {/* Billing Day */}
          <FormField
            control={form.control}
            name='billing_day'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Billing day (optional, 1–28)</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    max={28}
                    placeholder='e.g. 1'
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
          form='complete-install-form'
          disabled={isPending}
          className='gap-1.5'
        >
          {isPending && <Loader2 className='size-4 animate-spin' />}
          Install
        </Button>
      </SheetFooter>
    </SheetContent>
  )
}
