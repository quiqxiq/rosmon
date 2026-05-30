import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

function InstallForm({
  target,
  onClose,
}: {
  target: Registration
  onClose: () => void
}) {
  const mut = useCompleteInstall()
  const routersQuery = useRouters()

  const [deviceId, setDeviceId] = useState<string>(
    target.device_id ? String(target.device_id) : '',
  )
  const [serviceType, setServiceType] = useState<'pppoe' | 'hotspot'>(
    target.service_type === 'hotspot' ? 'hotspot' : 'pppoe',
  )
  const [profileId, setProfileId] = useState<string>(
    serviceType === 'pppoe'
      ? target.ppp_profile_id
        ? String(target.ppp_profile_id)
        : ''
      : target.hotspot_profile_id
        ? String(target.hotspot_profile_id)
        : '',
  )
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [billingDay, setBillingDay] = useState('')

  const rid = Number(deviceId) || 0
  const pppProfiles = usePPPDbProfiles(rid)
  const hsProfiles = useHotspotDbProfiles(rid)
  const hotspotPermanent = (hsProfiles.data ?? []).filter(
    (p) => p.role === 'permanent',
  )

  const onServiceChange = (v: string) => {
    setServiceType(v as 'pppoe' | 'hotspot')
    setProfileId('') // profiles differ per service
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!rid) return toast.error('Pick a device')
    if (!profileId) return toast.error('Pick a package')
    if (!username.trim() || !password.trim())
      return toast.error('MikroTik username and password are required')

    const payload: CompleteInstallInput = {
      device_id: rid,
      service_type: serviceType,
      mikrotik_username: username.trim(),
      mikrotik_password: password.trim(),
      ...(serviceType === 'pppoe'
        ? { ppp_profile_id: Number(profileId) }
        : { hotspot_profile_id: Number(profileId) }),
      ...(billingDay ? { billing_day: Number(billingDay) } : {}),
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
      <SheetHeader className='border-b'>
        <SheetTitle>Complete installation</SheetTitle>
        <SheetDescription>
          Provision '{target.full_name}' → creates an active subscription
          (synced to the router) + first invoice.
        </SheetDescription>
      </SheetHeader>

      <form
        id='complete-install-form'
        className='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4'
        onSubmit={submit}
      >
        <Field label='Device / Router'>
          <Select value={deviceId} onValueChange={setDeviceId}>
            <SelectTrigger>
              <SelectValue placeholder='Select a router' />
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

        <Field label='Service type'>
          <Select value={serviceType} onValueChange={onServiceChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='pppoe'>PPPoE</SelectItem>
              <SelectItem value='hotspot'>Hotspot</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label='Package'>
          <Select
            value={profileId}
            onValueChange={setProfileId}
            disabled={!rid}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={rid ? 'Select a package' : 'Pick a device first'}
              />
            </SelectTrigger>
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
        </Field>

        <Field label='MikroTik username'>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder='budi-001'
            autoComplete='off'
          />
        </Field>
        <Field label='MikroTik password'>
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete='off'
          />
        </Field>
        <Field label='Billing day (optional, 1–28)'>
          <Input
            type='number'
            min={1}
            max={28}
            value={billingDay}
            onChange={(e) => setBillingDay(e.target.value)}
            placeholder='e.g. 1'
          />
        </Field>
      </form>

      <SheetFooter className='border-t'>
        <SheetClose asChild>
          <Button variant='outline' size='sm' disabled={mut.isPending}>
            Cancel
          </Button>
        </SheetClose>
        <Button
          type='submit'
          size='sm'
          form='complete-install-form'
          disabled={mut.isPending}
          className='gap-1.5'
        >
          {mut.isPending && <Loader2 className='size-4 animate-spin' />}
          Install
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
