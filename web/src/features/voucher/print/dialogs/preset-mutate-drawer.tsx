import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import {
  Form,
  FormControl,
  FormDescription,
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
import { Switch } from '@/components/ui/switch'
import { colorClassMap } from '../data/data'
import {
  type PresetColor,
  type QuickPrintPreset,
} from '../data/schema'
import { presetToApi } from '../lib/preset-mapping'
import { usePresetsDialogStore } from '../store/presets-dialog-store'

// ── Constants ────────────────────────────────────────────────────────────────

const COLOR_OPTIONS: PresetColor[] = [
  'blue', 'indigo', 'purple', 'pink', 'red',
  'amber', 'green', 'teal', 'cyan', 'sky',
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

// ── Schema ──────────────────────────────────────────────────────────────────

const presetFormSchema = z.object({
  name: z.string().min(1, 'Internal name wajib diisi'),
  package: z.string().min(1, 'Display label wajib diisi'),
  color: z.string(),
  server: z.string(),
  profile: z.string(),
  userMode: z.enum(['up', 'vc']),
  userLength: z.number(),
  charSet: z.string(),
  prefix: z.string(),
  timeLimit: z.string(),
  dataLimit: z.number(),
  dataLimitUnit: z.enum(['MB', 'GB']),
  validity: z.string(),
  price: z.number(),
  sellingPrice: z.number(),
  lockUser: z.boolean(),
})

type PresetFormValues = z.infer<typeof presetFormSchema>

function defaultValues(
  profileFallback: string,
  target?: QuickPrintPreset | null,
): PresetFormValues {
  if (target) {
    return {
      name: target.name,
      package: target.package,
      color: target.color,
      server: target.server,
      profile: target.profile,
      userMode: target.userMode,
      userLength: target.userLength,
      charSet: target.charSet,
      prefix: target.prefix,
      timeLimit: target.timeLimit,
      dataLimit: target.dataLimit,
      dataLimitUnit: target.dataLimitUnit,
      validity: target.validity,
      price: target.price,
      sellingPrice: target.sellingPrice,
      lockUser: target.lockUser,
    }
  }
  return {
    name: 'QPNew',
    package: 'New Package',
    color: 'blue',
    server: 'HS-01',
    profile: profileFallback,
    userMode: 'up',
    userLength: 5,
    charSet: 'mix',
    prefix: '',
    timeLimit: '1h',
    dataLimit: 0,
    dataLimitUnit: 'MB',
    validity: '1h',
    price: 0,
    sellingPrice: 0,
    lockUser: true,
  }
}

// ── Root ─────────────────────────────────────────────────────────────────────

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

// ── Form ─────────────────────────────────────────────────────────────────────

type PresetFormProps = {
  mode: 'add' | 'edit'
  target: QuickPrintPreset | null
  onClose: () => void
}

function PresetForm({ mode, target, onClose }: PresetFormProps) {
  const routerId = useActiveRouterId()
  const profilesQuery = useHotspotProfiles(routerId ?? 0)
  const profiles = useMemo(
    () => profilesQuery.data ?? [],
    [profilesQuery.data],
  )
  const setMeta = useQuickPrintPresetsMetaStore((s) => s.set)
  const renameMeta = useQuickPrintPresetsMetaStore((s) => s.rename)

  const createMutation = useCreateQuickPrintPackage(routerId ?? 0)
  const updateMutation = useUpdateQuickPrintPackage(routerId ?? 0)
  const isPending = createMutation.isPending || updateMutation.isPending

  const profileFallback = profiles[0]?.name ?? ''
  const form = useForm<PresetFormValues>({
    resolver: zodResolver(presetFormSchema),
    defaultValues: defaultValues(profileFallback, mode === 'edit' ? target : null),
  })

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.name === form.watch('profile')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profiles, form.watch('profile')],
  )

  const handleProfileChange = (name: string, onChange: (v: string) => void) => {
    onChange(name)
    const p = profiles.find((it) => it.name === name)
    if (p) {
      if (p.validity) form.setValue('validity', p.validity)
      if (p.price) form.setValue('price', parseRouterOSNumber(p.price))
      if (p.selling_price)
        form.setValue('sellingPrice', parseRouterOSNumber(p.selling_price))
    }
  }

  const onSubmit = (values: PresetFormValues) => {
    if (routerId == null) {
      toast.error('Select a router first')
      return
    }

    const draft: QuickPrintPreset = {
      id: target?.id ?? '',
      ...values,
    }
    const apiBody = presetToApi(draft)
    const meta = { color: values.color, packageLabel: values.package }

    if (mode === 'add') {
      createMutation.mutate(apiBody, {
        onSuccess: () => {
          setMeta(values.name, meta)
          toast.success(`Preset '${values.name}' ditambahkan`)
          onClose()
        },
        onError: (err) =>
          toast.error('Gagal menambahkan preset', { description: err.message }),
      })
    } else if (mode === 'edit' && target) {
      updateMutation.mutate(
        { name: target.name, body: apiBody },
        {
          onSuccess: () => {
            if (target.name !== values.name) {
              renameMeta(target.name, values.name)
            }
            setMeta(values.name, meta)
            toast.success(`Preset '${values.name}' diperbarui`)
            onClose()
          },
          onError: (err) =>
            toast.error('Gagal memperbarui preset', {
              description: err.message,
            }),
        },
      )
    }
  }

  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
      <SheetHeader className='border-b px-6 py-4'>
        <SheetTitle>
          {mode === 'add' ? 'Add Quick-Print Preset' : 'Edit Preset'}
        </SheetTitle>
        <SheetDescription>
          Configure how a one-tap print batch is generated.
        </SheetDescription>
      </SheetHeader>

      <Form {...form}>
        <form
          id='preset-form'
          className='flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5'
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {/* Internal Name + Display Label */}
          <div className='grid grid-cols-2 gap-3'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Name</FormLabel>
                  <FormControl>
                    <Input placeholder='QP1' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='package'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Label</FormLabel>
                  <FormControl>
                    <Input placeholder='1Jam-1K' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Color picker — custom UI wrapped in FormField */}
          <FormField
            control={form.control}
            name='color'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Color</FormLabel>
                <FormControl>
                  <div className='flex flex-wrap gap-1.5'>
                    {COLOR_OPTIONS.map((c) => {
                      const cls = colorClassMap[c]
                      return (
                        <button
                          type='button'
                          key={c}
                          onClick={() => field.onChange(c)}
                          className={cn(
                            'size-7 rounded-md border-2 transition-all',
                            cls.bg,
                            field.value === c
                              ? cls.border +
                                  ' ring-2 ring-offset-1 ring-foreground/20'
                              : 'border-transparent',
                          )}
                          title={c}
                        />
                      )
                    })}
                  </div>
                </FormControl>
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

          {/* Profile */}
          <FormField
            control={form.control}
            name='profile'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Profile</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={(v) => handleProfileChange(v, field.onChange)}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select profile' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={p.id} value={p.name}>
                        {p.name} · {p.validity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProfile && (
                  <FormDescription>
                    Selling price syncs from selected profile.
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* User Mode + User Length */}
          <div className='grid grid-cols-2 gap-3'>
            <FormField
              control={form.control}
              name='userMode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User Mode</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='up'>User &amp; Password</SelectItem>
                      <SelectItem value='vc'>Voucher Code</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='userLength'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>User Length</FormLabel>
                  <Select
                    value={String(field.value)}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {USER_LENGTHS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Char Set */}
          <FormField
            control={form.control}
            name='charSet'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Char Set</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CHAR_SETS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Prefix */}
          <FormField
            control={form.control}
            name='prefix'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prefix</FormLabel>
                <FormControl>
                  <Input placeholder='Optional, e.g. wifi-' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Time Limit */}
          <FormField
            control={form.control}
            name='timeLimit'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time Limit</FormLabel>
                <FormControl>
                  <Input placeholder='1h, 30m, 1d, 0 = unlimited' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Data Limit + Unit */}
          <div className='grid grid-cols-[1fr_90px] gap-3'>
            <FormField
              control={form.control}
              name='dataLimit'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data Limit</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={0}
                      value={field.value}
                      onChange={(e) =>
                        field.onChange(
                          Math.max(
                            0,
                            Number.parseInt(e.target.value || '0', 10),
                          ),
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='dataLimitUnit'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Unit</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DATA_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Lock User */}
          <FormField
            control={form.control}
            name='lockUser'
            render={({ field }) => (
              <FormItem className='flex items-center justify-between rounded-md border p-3'>
                <div className='flex flex-col gap-0.5'>
                  <FormLabel>Lock User</FormLabel>
                  <FormDescription>
                    Bind voucher to first device that signs in.
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
