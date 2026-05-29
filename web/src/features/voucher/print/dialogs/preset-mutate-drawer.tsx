import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  useCreateQuickPrintPackage,
  useUpdateQuickPrintPackage,
} from '@/features/voucher/print/api/queries'
import { useHotspotProfiles } from '@/features/hotspot/profiles/api/queries'
import { parseRouterOSNumber } from '@/features/hotspot/_shared/format'
import { useActiveRouterId } from '@/stores/active-router-store'
import { useQuickPrintPresetsMetaStore } from '@/stores/quick-print-presets-meta-store'
import { cn } from '@/lib/utils'
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
import { Switch } from '@/components/ui/switch'
import { colorClassMap } from '../data/data'
import {
  type PresetColor,
  type QuickPrintPreset,
} from '../data/schema'
import { presetToApi } from '../lib/preset-mapping'
import { usePresetsDialogStore } from '../store/presets-dialog-store'

const COLOR_OPTIONS: PresetColor[] = [
  'blue',
  'indigo',
  'purple',
  'pink',
  'red',
  'amber',
  'green',
  'teal',
  'cyan',
  'sky',
]

const CHAR_SETS: Array<{ label: string; value: QuickPrintPreset['charSet'] }> = [
  { label: 'Lower (abcd)', value: 'lower' },
  { label: 'Upper (ABCD)', value: 'upper' },
  { label: 'Upper + Lower (aBcD)', value: 'upplow' },
  { label: 'Number + Lower (5ab2c)', value: 'mix' },
  { label: 'Number + Upper (5AB2C)', value: 'mix1' },
  { label: 'Number + Upper + Lower (5aB2C)', value: 'mix2' },
  { label: 'Number Only (1234)', value: 'num' },
]

const SERVERS = ['all', 'HS-01', 'HS-02', 'HS-03']

const USER_LENGTHS = [3, 4, 5, 6, 7, 8]

const DATA_UNITS: Array<QuickPrintPreset['dataLimitUnit']> = ['MB', 'GB']

function emptyPreset(profileFallback: string): QuickPrintPreset {
  return {
    id: '',
    name: 'QPNew',
    package: 'New Package',
    server: 'HS-01',
    userMode: 'up',
    userLength: 5,
    prefix: '',
    charSet: 'mix',
    profile: profileFallback,
    timeLimit: '1h',
    dataLimit: 0,
    dataLimitUnit: 'MB',
    validity: '1h',
    price: 0,
    sellingPrice: 0,
    lockUser: true,
    color: 'blue',
  }
}

export function PresetMutateDrawer() {
  const { mode, target, close } = usePresetsDialogStore()
  const isOpen = mode === 'add' || mode === 'edit'
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && (
        <PresetForm
          key={target?.id ?? `add-${mode}`}
          mode={mode === 'edit' ? 'edit' : 'add'}
          target={target}
          onClose={close}
        />
      )}
    </Sheet>
  )
}

type PresetFormProps = {
  mode: 'add' | 'edit'
  target: QuickPrintPreset | null
  onClose: () => void
}

function PresetForm({ mode, target, onClose }: PresetFormProps) {
  const routerId = useActiveRouterId()
  // Live profiles list — used to populate the picker and to auto-fill
  // pricing/validity when the user picks a profile. The pricing fields
  // are RouterOS strings; we parse them to numbers at sync time.
  // Wrapped in useMemo so the `?? []` fallback keeps a stable reference
  // when the query has no data yet, otherwise downstream useMemos
  // re-run every render.
  const profilesQuery = useHotspotProfiles(routerId ?? 0)
  const profiles = useMemo(
    () => profilesQuery.data ?? [],
    [profilesQuery.data],
  )
  const setMeta = useQuickPrintPresetsMetaStore((s) => s.set)
  const renameMeta = useQuickPrintPresetsMetaStore((s) => s.rename)

  // The drawer is rendered only when a router is selected (the parent
  // page gates this), but we still pass `0` defensively so the hooks
  // satisfy their `enabled` guard either way.
  const createMutation = useCreateQuickPrintPackage(routerId ?? 0)
  const updateMutation = useUpdateQuickPrintPackage(routerId ?? 0)
  const isPending = createMutation.isPending || updateMutation.isPending

  const profileFallback = profiles[0]?.name ?? ''
  const [draft, setDraft] = useState<QuickPrintPreset>(() => {
    if (mode === 'edit' && target) return target
    return emptyPreset(profileFallback)
  })

  const profileItem = useMemo(
    () => profiles.find((p) => p.name === draft.profile),
    [profiles, draft.profile]
  )

  const update = <K extends keyof QuickPrintPreset>(
    key: K,
    value: QuickPrintPreset[K]
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleProfileChange = (name: string) => {
    const p = profiles.find((it) => it.name === name)
    setDraft((prev) => ({
      ...prev,
      profile: name,
      validity: p?.validity ?? prev.validity,
      price: p?.price ? parseRouterOSNumber(p.price) : prev.price,
      sellingPrice: p?.selling_price
        ? parseRouterOSNumber(p.selling_price)
        : prev.sellingPrice,
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.name.trim()) {
      toast.error('Name is required')
      return
    }
    if (routerId == null) {
      toast.error('Select a router first')
      return
    }

    const apiBody = presetToApi(draft)
    const meta = { color: draft.color, packageLabel: draft.package }

    if (mode === 'add') {
      createMutation.mutate(apiBody, {
        onSuccess: () => {
          // Meta lives in localStorage and is keyed by `name`; write it
          // AFTER the backend confirms the create so an offline failure
          // doesn't leave orphaned color/label entries.
          setMeta(draft.name, meta)
          toast.success(`Preset '${draft.name}' added`)
          onClose()
        },
        onError: (err) => {
          toast.error('Failed to add preset', { description: err.message })
        },
      })
    } else if (mode === 'edit' && target) {
      // Backend identifies packages by name → renaming is a PUT against
      // the OLD name where body.name carries the NEW name. Mirror the
      // rename in the meta store so the local color/label follows.
      updateMutation.mutate(
        { name: target.name, body: apiBody },
        {
          onSuccess: () => {
            if (target.name !== draft.name) {
              renameMeta(target.name, draft.name)
            }
            setMeta(draft.name, meta)
            toast.success(`Preset '${draft.name}' updated`)
            onClose()
          },
          onError: (err) => {
            toast.error('Failed to update preset', {
              description: err.message,
            })
          },
        },
      )
    }
  }

  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
        <SheetHeader className='border-b'>
          <SheetTitle>
            {mode === 'add' ? 'Add Quick-Print Preset' : 'Edit Preset'}
          </SheetTitle>
          <SheetDescription>
            Configure how a one-tap print batch is generated.
          </SheetDescription>
        </SheetHeader>

        <form
          id='preset-form'
          className='flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4'
          onSubmit={handleSubmit}
        >
          <div className='grid grid-cols-2 gap-3'>
            <Field label='Internal Name'>
              <Input
                value={draft.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder='QP1'
              />
            </Field>
            <Field label='Display Label'>
              <Input
                value={draft.package}
                onChange={(e) => update('package', e.target.value)}
                placeholder='1Jam-1K'
              />
            </Field>
          </div>

          <Field label='Color'>
            <div className='flex flex-wrap gap-1.5'>
              {COLOR_OPTIONS.map((c) => {
                const cls = colorClassMap[c]
                return (
                  <button
                    type='button'
                    key={c}
                    onClick={() => update('color', c)}
                    className={cn(
                      'size-7 rounded-md border-2 transition-all',
                      cls.bg,
                      draft.color === c
                        ? cls.border + ' ring-2 ring-offset-1 ring-foreground/20'
                        : 'border-transparent'
                    )}
                    title={c}
                  />
                )
              })}
            </div>
          </Field>

          <Field label='Server'>
            <Select
              value={draft.server}
              onValueChange={(v) => update('server', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVERS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label='Profile'>
            <Select
              value={draft.profile}
              onValueChange={handleProfileChange}
            >
              <SelectTrigger>
                <SelectValue placeholder='Select profile' />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name} · {p.validity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {profileItem && (
              <p className='text-[11px] text-muted-foreground'>
                Selling price syncs from selected profile.
              </p>
            )}
          </Field>

          <div className='grid grid-cols-2 gap-3'>
            <Field label='User Mode'>
              <Select
                value={draft.userMode}
                onValueChange={(v) =>
                  update('userMode', v as QuickPrintPreset['userMode'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='up'>User & Password</SelectItem>
                  <SelectItem value='vc'>Voucher Code</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label='User Length'>
              <Select
                value={String(draft.userLength)}
                onValueChange={(v) => update('userLength', Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_LENGTHS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label='Char Set'>
            <Select
              value={draft.charSet}
              onValueChange={(v) =>
                update('charSet', v as QuickPrintPreset['charSet'])
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAR_SETS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label='Prefix'>
            <Input
              value={draft.prefix}
              onChange={(e) => update('prefix', e.target.value)}
              placeholder='Optional, e.g. wifi-'
            />
          </Field>

          <Field label='Time Limit'>
            <Input
              value={draft.timeLimit}
              onChange={(e) => update('timeLimit', e.target.value)}
              placeholder='1h, 30m, 1d, 0 = unlimited'
            />
          </Field>

          <div className='grid grid-cols-[1fr_90px] gap-3'>
            <Field label='Data Limit'>
              <Input
                type='number'
                min={0}
                value={draft.dataLimit}
                onChange={(e) =>
                  update(
                    'dataLimit',
                    Math.max(0, Number.parseInt(e.target.value || '0', 10))
                  )
                }
              />
            </Field>
            <Field label='Unit'>
              <Select
                value={draft.dataLimitUnit}
                onValueChange={(v) =>
                  update('dataLimitUnit', v as QuickPrintPreset['dataLimitUnit'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATA_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className='flex items-center justify-between rounded-md border p-3'>
            <div className='flex flex-col gap-0.5'>
              <Label className='text-sm'>Lock User</Label>
              <span className='text-[11px] text-muted-foreground'>
                Bind voucher to first device that signs in.
              </span>
            </div>
            <Switch
              checked={draft.lockUser}
              onCheckedChange={(v) => update('lockUser', v)}
            />
          </div>
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
            form='preset-form'
            disabled={isPending}
            className='gap-1.5'
          >
            {isPending && <Loader2 className='size-4 animate-spin' />}
            {mode === 'add' ? 'Add Preset' : 'Save Changes'}
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
