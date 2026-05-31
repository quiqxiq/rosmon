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
  useCreatePPPDbProfile,
  useUpdatePPPDbProfile,
} from '../api/queries'
import {
  type PPPDbProfile,
  type PPPDbProfileCreateInput,
  type PPPDbProfileUpdateInput,
} from '../api/schema'
import { useDbProfilesDialogStore } from '../store/db-profiles-dialog-store'

// ── Schema ──────────────────────────────────────────────────────────────────

const dbProfileFormSchema = z.object({
  name: z.string(),
  rate_limit: z.string(),
  price_monthly: z.string(),
  local_address: z.string(),
  remote_address: z.string(),
  session_timeout: z.string(),
  idle_timeout: z.string(),
  parent_queue: z.string(),
  description: z.string(),
  active: z.enum(['true', 'false']),
  is_public: z.boolean(),
})

const addSchema = dbProfileFormSchema.extend({
  name: z.string().min(1, 'Name wajib diisi'),
})

type DbProfileFormValues = z.infer<typeof dbProfileFormSchema>

function defaultValues(target?: PPPDbProfile | null): DbProfileFormValues {
  return {
    name: target?.name ?? '',
    rate_limit: target?.rate_limit ?? '',
    price_monthly: target?.price_monthly ? String(target.price_monthly) : '',
    local_address: target?.local_address ?? '',
    remote_address: target?.remote_address ?? '',
    session_timeout: target?.session_timeout ?? '',
    idle_timeout: target?.idle_timeout ?? '',
    parent_queue: target?.parent_queue ?? '',
    description: target?.description ?? '',
    active: target?.active ? 'true' : 'false',
    is_public: target?.is_public ?? false,
  }
}

// ── Root ─────────────────────────────────────────────────────────────────────

export function DbProfileMutateDrawer() {
  const { mode, target, close } = useDbProfilesDialogStore()
  const isOpen = mode === 'add' || mode === 'edit'
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && (
        <DbProfileForm
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

type DbProfileFormProps = {
  mode: 'add' | 'edit'
  target: PPPDbProfile | null
  onClose: () => void
}

function DbProfileForm({ mode, target, onClose }: DbProfileFormProps) {
  const routerId = useActiveRouterId() ?? 0
  const createMutation = useCreatePPPDbProfile(routerId)
  const updateMutation = useUpdatePPPDbProfile(routerId)

  const { data: pools, isLoading: poolsLoading } = usePools(routerId)
  const addressPoolOptions = useMemo(
    () => (pools ?? []).map((p) => ({ label: p.name, value: p.name })),
    [pools],
  )

  const isEdit = mode === 'edit'
  const form = useForm<DbProfileFormValues>({
    resolver: zodResolver(isEdit ? dbProfileFormSchema : addSchema),
    defaultValues: defaultValues(isEdit ? target : null),
  })

  const isPending = createMutation.isPending || updateMutation.isPending

  const parsePrice = (s: string): number => {
    const n = Number(s)
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0
  }

  const onSubmit = (values: DbProfileFormValues) => {
    const common = {
      rate_limit: values.rate_limit.trim(),
      local_address: values.local_address.trim(),
      remote_address: values.remote_address.trim(),
      session_timeout: values.session_timeout.trim(),
      idle_timeout: values.idle_timeout.trim(),
      parent_queue: values.parent_queue.trim(),
      description: values.description.trim(),
      price_monthly: parsePrice(values.price_monthly),
      active: values.active === 'true',
      is_public: values.is_public,
    }

    if (mode === 'add') {
      const payload: PPPDbProfileCreateInput = {
        name: values.name.trim(),
        ...common,
      }
      createMutation.mutate(payload, {
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
      })
      return
    }

    if (!target) return
    const payload: PPPDbProfileUpdateInput = { ...common }
    updateMutation.mutate(
      { id: target.id, payload },
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
          {mode === 'add' ? 'Add Billing Profile' : 'Edit Billing Profile'}
        </SheetTitle>
        <SheetDescription>
          DB-backed PPP plan · synced to RouterOS best-effort
        </SheetDescription>
      </SheetHeader>

      <Form {...form}>
        <form
          id='ppp-db-profile-form'
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
                    placeholder='paket-10M'
                    autoComplete='off'
                    disabled={isEdit}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Rate Limit + Price */}
          <div className='grid grid-cols-2 gap-3'>
            <FormField
              control={form.control}
              name='rate_limit'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rate Limit (rx/tx)</FormLabel>
                  <FormControl>
                    <Input placeholder='10M/10M' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='price_monthly'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price / bulan (IDR)</FormLabel>
                  <FormControl>
                    <Input type='number' min='0' placeholder='150000' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Local + Remote Address */}
          <div className='grid grid-cols-2 gap-3'>
            <FormField
              control={form.control}
              name='local_address'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Local Address</FormLabel>
                  <FormControl>
                    <InputCombobox
                      options={addressPoolOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder='10.0.0.1'
                      isLoading={poolsLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='remote_address'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remote Address</FormLabel>
                  <FormControl>
                    <InputCombobox
                      options={addressPoolOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder='pool name / IP'
                      isLoading={poolsLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Session + Idle Timeout */}
          <div className='grid grid-cols-2 gap-3'>
            <FormField
              control={form.control}
              name='session_timeout'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session Timeout</FormLabel>
                  <FormControl>
                    <Input placeholder='1h30m' {...field} />
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
                    <Input placeholder='10m' {...field} />
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
                  <Input placeholder='queue name' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name='description'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='Home 10 Mbps plan'
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

          {/* Public package */}
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
          form='ppp-db-profile-form'
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
