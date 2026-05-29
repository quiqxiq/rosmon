import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

type Draft = {
  customer_id: string
  device_id: string
  service_type: ServiceType
  profile_id: string
  mikrotik_username: string
  mikrotik_password: string
  notes: string
}

export function SubscriptionMutateDrawer() {
  const { mode, target, close } = useSubscriptionsDialogStore()
  const isOpen = mode === 'add' || mode === 'edit'
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && (
        <Form
          key={target?.id ?? `add-${mode}`}
          mode={mode === 'edit' ? 'edit' : 'add'}
          target={target}
          onClose={close}
        />
      )}
    </Sheet>
  )
}

function Form({
  mode,
  target,
  onClose,
}: {
  mode: 'add' | 'edit'
  target: Subscription | null
  onClose: () => void
}) {
  const customersQuery = useCustomers()
  const routersQuery = useRouters()
  const createMutation = useCreateSubscription()
  const updateMutation = useUpdateSubscription()

  const [draft, setDraft] = useState<Draft>(() => ({
    customer_id: target ? String(target.customer_id) : '',
    device_id: target ? String(target.device_id) : '',
    service_type: (target?.service_type as ServiceType) ?? 'pppoe',
    profile_id: target
      ? String(target.ppp_profile_id ?? target.hotspot_profile_id ?? '')
      : '',
    mikrotik_username: target?.mikrotik_username ?? '',
    mikrotik_password: '',
    notes: target?.notes ?? '',
  }))

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const deviceId = Number(draft.device_id) || 0
  const pppProfiles = usePPPDbProfiles(
    draft.service_type === 'pppoe' ? deviceId : 0,
  )
  const hotspotProfiles = useHotspotDbProfiles(
    draft.service_type === 'hotspot' ? deviceId : 0,
    { role: 'permanent' },
  )

  const profileOptions = useMemo(() => {
    if (draft.service_type === 'pppoe')
      return (pppProfiles.data ?? []).map((p) => ({
        value: String(p.id),
        label: p.name,
      }))
    return (hotspotProfiles.data ?? []).map((p) => ({
      value: String(p.id),
      label: p.name,
    }))
  }, [draft.service_type, pppProfiles.data, hotspotProfiles.data])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === 'add') {
      if (
        !draft.customer_id ||
        !draft.device_id ||
        !draft.mikrotik_username.trim() ||
        !draft.mikrotik_password.trim()
      ) {
        toast.error('Customer, device, username and password are required')
        return
      }
      const profileId = Number(draft.profile_id) || undefined
      const payload: SubscriptionCreateInput = {
        customer_id: Number(draft.customer_id),
        device_id: Number(draft.device_id),
        service_type: draft.service_type,
        mikrotik_username: draft.mikrotik_username.trim(),
        mikrotik_password: draft.mikrotik_password,
        notes: draft.notes.trim() || undefined,
        ...(draft.service_type === 'pppoe'
          ? { ppp_profile_id: profileId }
          : { hotspot_profile_id: profileId }),
      }
      createMutation.mutate(payload, {
        onSuccess: (res) => {
          toast.success('Subscription created', { description: res.warning })
          onClose()
        },
        onError: (err) =>
          toast.error('Failed to create subscription', {
            description: parseAPIError(err),
          }),
      })
      return
    }

    if (!target) return
    const profileId = Number(draft.profile_id) || undefined
    updateMutation.mutate(
      {
        id: target.id,
        payload: {
          notes: draft.notes.trim(),
          mikrotik_password: draft.mikrotik_password.trim() || undefined,
          ...(target.service_type === 'pppoe'
            ? { ppp_profile_id: profileId }
            : { hotspot_profile_id: profileId }),
        },
      },
      {
        onSuccess: (res) => {
          toast.success('Subscription updated', { description: res.warning })
          onClose()
        },
        onError: (err) =>
          toast.error('Failed to update subscription', {
            description: parseAPIError(err),
          }),
      },
    )
  }

  const isPending = createMutation.isPending || updateMutation.isPending
  const isEdit = mode === 'edit'

  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
      <SheetHeader className='border-b'>
        <SheetTitle>
          {isEdit ? 'Edit Subscription' : 'New Subscription'}
        </SheetTitle>
        <SheetDescription>
          Links a customer to a device profile and provisions the MikroTik
          secret/user.
        </SheetDescription>
      </SheetHeader>

      <form
        id='subscription-form'
        className='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4'
        onSubmit={handleSubmit}
      >
        <Field label='Customer'>
          <Select
            value={draft.customer_id}
            onValueChange={(v) => update('customer_id', v)}
            disabled={isEdit}
          >
            <SelectTrigger>
              <SelectValue placeholder='Select customer' />
            </SelectTrigger>
            <SelectContent>
              {(customersQuery.data ?? []).map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label='Device'>
          <Select
            value={draft.device_id}
            onValueChange={(v) => update('device_id', v)}
            disabled={isEdit}
          >
            <SelectTrigger>
              <SelectValue placeholder='Select device' />
            </SelectTrigger>
            <SelectContent>
              {(routersQuery.data ?? []).map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label='Service Type'>
          <Select
            value={draft.service_type}
            onValueChange={(v) => {
              update('service_type', v as ServiceType)
              update('profile_id', '')
            }}
            disabled={isEdit}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='pppoe'>PPPoE</SelectItem>
              <SelectItem value='hotspot'>Hotspot</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label='Billing Profile'>
          <Select
            value={draft.profile_id}
            onValueChange={(v) => update('profile_id', v)}
            disabled={deviceId === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  deviceId === 0 ? 'Select a device first' : 'Select profile'
                }
              />
            </SelectTrigger>
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
        </Field>

        <Field label='MikroTik Username'>
          <Input
            value={draft.mikrotik_username}
            onChange={(e) => update('mikrotik_username', e.target.value)}
            placeholder='pppoe-budi'
            disabled={isEdit}
            autoComplete='off'
          />
        </Field>

        <Field
          label={
            isEdit ? 'MikroTik Password (blank = keep)' : 'MikroTik Password'
          }
        >
          <Input
            value={draft.mikrotik_password}
            onChange={(e) => update('mikrotik_password', e.target.value)}
            placeholder='••••'
            autoComplete='off'
          />
        </Field>

        <Field label='Notes'>
          <Textarea
            value={draft.notes}
            onChange={(e) => update('notes', e.target.value)}
            rows={2}
          />
        </Field>
      </form>

      <SheetFooter className='border-t'>
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

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col gap-1.5'>
      <Label className='text-xs font-medium text-muted-foreground'>
        {label}
      </Label>
      {children}
    </div>
  )
}
