import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { useHotspotDbProfiles } from '@/features/hotspot/billing/api/queries'
import { useGenerateVoucher, useHotspotServers } from '@/features/voucher/generate/api/queries'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatIDR } from '@/features/hotspot/profiles/data/data'
import {
  charSetOptions,
  dataLimitToBytes,
  dataLimitUnitOptions,
  defaultGenerateForm,
  nameLengthOptions,
  userTypeOptions,
} from '../data/data'
import {
  voucherGenerateFormSchema,
  type GeneratedVoucher,
  type VoucherGenerateForm,
} from '../data/schema'
import type { VoucherGenerateParams } from '../api/schema'

type Props = {
  onSuccess: (
    vouchers: GeneratedVoucher[],
    profile: string,
    server: string,
  ) => void
}

function formToBackendParams(form: VoucherGenerateForm): VoucherGenerateParams {
  const dataLimit = dataLimitToBytes(form.dataLimit, form.dataLimitUnit)
  return {
    batch_size: form.qty,
    server: form.server === 'all' ? undefined : form.server,
    user_mode: form.userType,
    length: form.nameLength,
    prefix: form.prefix || undefined,
    charset: form.charSet,
    profile: form.profile,
    time_limit: form.timeLimit && form.timeLimit !== '0' ? form.timeLimit : undefined,
    data_limit: dataLimit > 0 ? dataLimit : undefined,
    comment: form.comment || undefined,
  }
}

export function VoucherGenerateFormPanel({ onSuccess }: Props) {
  const routerId = useActiveRouterId() ?? 0

  // Tampilkan semua profile tanpa filter role — billing role adalah
  // klasifikasi internal, bukan konsep MikroTik. Sync dari billing page
  // menggunakan role=permanent secara default.
  const profilesQuery = useHotspotDbProfiles(routerId)
  const serversQuery = useHotspotServers(routerId)
  const generateMutation = useGenerateVoucher(routerId)

  const profiles = profilesQuery.data ?? []
  const activeServers: { name: string }[] = [
    { name: 'all' },
    ...(serversQuery.data ?? []).filter((s) => !s.disabled),
  ]

  const form = useForm<VoucherGenerateForm>({
    resolver: zodResolver(voucherGenerateFormSchema),
    defaultValues: defaultGenerateForm,
  })

  // Auto-select first voucher profile when data arrives
  useEffect(() => {
    if (profiles.length > 0 && !form.getValues('profile')) {
      form.setValue('profile', profiles[0].name)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles.length])

  function onSubmit(values: VoucherGenerateForm) {
    generateMutation.mutate(formToBackendParams(values), {
      onSuccess: (data) => {
        const enriched: GeneratedVoucher[] = data.vouchers.map((v, i) => ({
          id: `${data.gencode}-${i + 1}`,
          username: v.username,
          password: v.password,
          profile: data.profile,
          comment: values.comment || '',
        }))
        onSuccess(enriched, data.profile, values.server)
        toast.success(
          `Generated ${data.count} voucher${data.count > 1 ? 's' : ''}`,
          { description: `Profile: ${data.profile} · Gencode: ${data.gencode}` },
        )
      },
      onError: (err) => {
        toast.error('Failed to generate vouchers', { description: err.message })
      },
    })
  }

  const isPending = generateMutation.isPending

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Generate Configuration</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className='flex flex-col gap-4'
          >
            {/* Quantity + Server */}
            <div className='grid grid-cols-2 gap-3'>
              <FormField
                control={form.control}
                name='qty'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={1}
                        max={500}
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            Math.max(1, Math.min(500, +e.target.value || 1)),
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
                name='server'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Server</FormLabel>
                    {serversQuery.isLoading ? (
                      <Skeleton className='h-9 w-full' />
                    ) : (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activeServers.map((s) => (
                            <SelectItem key={s.name} value={s.name}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Profile */}
            <FormField
              control={form.control}
              name='profile'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Profile</FormLabel>
                  {profilesQuery.isLoading ? (
                    <Skeleton className='h-9 w-full' />
                  ) : (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Pilih profile' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {profiles.length === 0 ? (
                          <SelectItem value='__none' disabled>
                            Belum ada profile voucher di router ini
                          </SelectItem>
                        ) : (
                          profiles.map((p) => (
                            <SelectItem key={p.id} value={p.name}>
                              <span className='flex items-center justify-between gap-3 w-full'>
                                <span>{p.name}</span>
                                <span className='text-xs text-muted-foreground tabular-nums'>
                                  {p.sell_price ? formatIDR(p.sell_price) : ''}
                                  {p.validity ? ` · ${p.validity}` : ''}
                                </span>
                              </span>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* User Mode */}
            <FormField
              control={form.control}
              name='userType'
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
                      {userTypeOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Name Length + Char Set */}
            <div className='grid grid-cols-2 gap-3'>
              <FormField
                control={form.control}
                name='nameLength'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name Length</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(+v)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {nameLengthOptions.map((opt) => (
                          <SelectItem key={opt.value} value={String(opt.value)}>
                            {opt.label}
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
                        {charSetOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                    <Input
                      placeholder='e.g. 1h, 30m, or 0 for unlimited'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Data Limit + Unit — InputGroup */}
            <div className='space-y-1.5'>
              <FormLabel>Data Limit</FormLabel>
              <InputGroup>
                <FormField
                  control={form.control}
                  name='dataLimit'
                  render={({ field }) => (
                    <InputGroupInput
                      type='number'
                      min={0}
                      placeholder='0 = unlimited'
                      value={field.value}
                      onChange={(e) =>
                        field.onChange(Math.max(0, +e.target.value || 0))
                      }
                    />
                  )}
                />
                <InputGroupAddon align='inline-end'>
                  <FormField
                    control={form.control}
                    name='dataLimitUnit'
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className='h-7 w-16 border-0 shadow-none focus:ring-0 text-xs'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align='end'>
                          {dataLimitUnitOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </InputGroupAddon>
              </InputGroup>
            </div>

            {/* Comment */}
            <FormField
              control={form.control}
              name='comment'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment</FormLabel>
                  <FormControl>
                    <Input placeholder='Optional batch comment' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className='flex flex-wrap gap-2 pt-2'>
              <Button
                type='submit'
                size='sm'
                className='gap-1.5'
                disabled={isPending || routerId === 0}
              >
                {isPending ? (
                  <Loader2 className='size-4 animate-spin' />
                ) : (
                  <Plus className='size-4' />
                )}
                {isPending ? 'Generating…' : 'Generate'}
              </Button>
              <Button
                type='button'
                variant='outline'
                size='sm'
                className='gap-1.5'
                onClick={() => form.reset(defaultGenerateForm)}
                disabled={isPending}
              >
                <RotateCcw className='size-4' />
                Reset
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
