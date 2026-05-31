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
import { Textarea } from '@/components/ui/textarea'
import { InputCombobox } from '@/components/input-combobox'
import { parseAPIError } from '@/lib/api/errors'
import { usePools } from '@/features/network/api/queries'
import { useAddPPPSecret, useUpdatePPPSecret } from '../api/queries'
import {
  PPP_SERVICES,
  type PPPSecret,
  type PPPSecretCreateInput,
  type PPPSecretUpdateInput,
} from '../api/schema'
import { useSecretsDialogStore } from '../store/secrets-dialog-store'

// ── Schema ──────────────────────────────────────────────────────────────────

const baseSchema = z.object({
  name: z.string().min(1, 'Username wajib diisi'),
  password: z.string(),
  service: z.string(),
  profile: z.string(),
  local_address: z.string(),
  remote_address: z.string(),
  comment: z.string(),
})

const addSchema = baseSchema.extend({
  password: z.string().min(1, 'Password wajib diisi'),
})

type SecretFormValues = z.infer<typeof baseSchema>

function defaultValues(target?: PPPSecret | null): SecretFormValues {
  return {
    name: target?.name ?? '',
    password: '',
    service: target?.service ?? 'any',
    profile: target?.profile ?? '',
    local_address: target?.local_address ?? '',
    remote_address: target?.remote_address ?? '',
    comment: target?.comment ?? '',
  }
}

// ── Root ─────────────────────────────────────────────────────────────────────

export function SecretMutateDrawer() {
  const { mode, target, close } = useSecretsDialogStore()
  const isOpen = mode === 'add' || mode === 'edit'
  return (
    <Sheet open={isOpen} onOpenChange={(o) => !o && close()}>
      {isOpen && (
        <SecretForm
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

type SecretFormProps = {
  mode: 'add' | 'edit'
  target: PPPSecret | null
  onClose: () => void
}

function SecretForm({ mode, target, onClose }: SecretFormProps) {
  const routerId = useActiveRouterId() ?? 0
  const addMutation = useAddPPPSecret(routerId)
  const updateMutation = useUpdatePPPSecret(routerId)

  const { data: pools, isLoading: poolsLoading } = usePools(routerId)
  const addressPoolOptions = useMemo(
    () => (pools ?? []).map((p) => ({ label: p.name, value: p.name })),
    [pools],
  )

  const isEdit = mode === 'edit'
  const form = useForm<SecretFormValues>({
    resolver: zodResolver(isEdit ? baseSchema : addSchema),
    defaultValues: defaultValues(isEdit ? target : null),
  })

  const isPending = addMutation.isPending || updateMutation.isPending

  const onSubmit = (values: SecretFormValues) => {
    if (mode === 'add') {
      const payload: PPPSecretCreateInput = {
        name: values.name.trim(),
        password: values.password,
        service: values.service,
      }
      if (values.profile.trim()) payload.profile = values.profile.trim()
      if (values.local_address.trim())
        payload.local_address = values.local_address.trim()
      if (values.remote_address.trim())
        payload.remote_address = values.remote_address.trim()

      addMutation.mutate(payload, {
        onSuccess: () => {
          toast.success(`Secret '${values.name}' ditambahkan`)
          onClose()
        },
        onError: (err) =>
          toast.error('Gagal menambahkan secret', {
            description: parseAPIError(err),
          }),
      })
      return
    }

    if (!target) return
    const patch: PPPSecretUpdateInput = {
      name: values.name.trim(),
      service: values.service,
      profile: values.profile.trim(),
      local_address: values.local_address.trim(),
      remote_address: values.remote_address.trim(),
      comment: values.comment.trim(),
    }
    if (values.password.trim()) patch.password = values.password.trim()

    updateMutation.mutate(
      { id: target.id, patch },
      {
        onSuccess: () => {
          toast.success(`Secret '${values.name}' diperbarui`)
          onClose()
        },
        onError: (err) =>
          toast.error('Gagal memperbarui secret', {
            description: parseAPIError(err),
          }),
      },
    )
  }

  return (
    <SheetContent className='flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md'>
      <SheetHeader className='border-b px-6 py-4'>
        <SheetTitle>
          {mode === 'add' ? 'Add PPP Secret' : 'Edit PPP Secret'}
        </SheetTitle>
        <SheetDescription>
          PPPoE / PPP credential · profile · addresses
        </SheetDescription>
      </SheetHeader>

      <Form {...form}>
        <form
          id='secret-form'
          className='flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5'
          onSubmit={form.handleSubmit(onSubmit)}
        >
          {/* Username + Password */}
          <div className='grid grid-cols-2 gap-3'>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='pppoe-001'
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
              name='password'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isEdit ? 'Password (kosongkan = tetap)' : 'Password'}
                  </FormLabel>
                  <FormControl>
                    <Input placeholder='••••' autoComplete='off' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Service */}
          <FormField
            control={form.control}
            name='service'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {PPP_SERVICES.map((s) => (
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
                <FormControl>
                  <Input
                    placeholder='default'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
                      placeholder='10.0.0.2 / pool'
                      isLoading={poolsLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Comment — edit only */}
          {isEdit && (
            <FormField
              control={form.control}
              name='comment'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder='Catatan opsional...'
                      className='resize-none'
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
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
          form='secret-form'
          disabled={isPending}
          className='gap-1.5'
        >
          {isPending && <Loader2 className='size-4 animate-spin' />}
          {mode === 'add' ? 'Add Secret' : 'Save Changes'}
        </Button>
      </SheetFooter>
    </SheetContent>
  )
}
