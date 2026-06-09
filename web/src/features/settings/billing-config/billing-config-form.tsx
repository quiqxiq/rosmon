import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useSystemSettings, useUpdateSetting } from '../api/queries'

const schema = z.object({
  default_billing_day: z
    .string()
    .regex(/^\d+$/, 'Harus berupa angka')
    .refine((v) => +v >= 1 && +v <= 28, { message: 'Harus antara 1–28' }),
  invoice_due_days: z
    .string()
    .regex(/^\d+$/, 'Harus berupa angka')
    .refine((v) => +v >= 1, { message: 'Minimal 1 hari' }),
  isolir_after_days: z
    .string()
    .regex(/^\d+$/, 'Harus berupa angka')
    .refine((v) => +v >= 0, { message: 'Minimal 0 hari' }),
  hard_suspend_after_days: z
    .string()
    .regex(/^\d+$/, 'Harus berupa angka')
    .refine((v) => +v >= 1, { message: 'Minimal 1 hari' }),
  isolir_profile_name: z.string().min(1, 'Wajib diisi'),
})

type FormValues = z.infer<typeof schema>

const BILLING_KEYS = [
  'billing.default_billing_day',
  'billing.invoice_due_days',
  'billing.isolir_after_days',
  'billing.hard_suspend_after_days',
  'billing.isolir_profile_name',
] as const

export function BillingConfigForm() {
  const { data: settings, isLoading } = useSystemSettings()
  const { mutate: updateSetting, isPending: isSaving } = useUpdateSetting()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      default_billing_day: '1',
      invoice_due_days: '7',
      isolir_after_days: '3',
      hard_suspend_after_days: '14',
      isolir_profile_name: 'isolir',
    },
  })

  useEffect(() => {
    if (!settings) return
    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value
    form.reset({
      default_billing_day: map['billing.default_billing_day'] ?? '1',
      invoice_due_days: map['billing.invoice_due_days'] ?? '7',
      isolir_after_days: map['billing.isolir_after_days'] ?? '3',
      hard_suspend_after_days: map['billing.hard_suspend_after_days'] ?? '14',
      isolir_profile_name: map['billing.isolir_profile_name'] ?? 'isolir',
    })
  }, [settings, form])

  function onSubmit(values: FormValues) {
    const updates: { key: string; value: string }[] = [
      { key: 'billing.default_billing_day', value: values.default_billing_day },
      { key: 'billing.invoice_due_days', value: values.invoice_due_days },
      { key: 'billing.isolir_after_days', value: values.isolir_after_days },
      { key: 'billing.hard_suspend_after_days', value: values.hard_suspend_after_days },
      { key: 'billing.isolir_profile_name', value: values.isolir_profile_name },
    ]
    let done = 0
    for (const { key, value } of updates) {
      updateSetting({ key, value }, {
        onSuccess: () => {
          done++
          if (done === updates.length) {
            toast.success('Konfigurasi billing berhasil disimpan.')
          }
        },
        onError: () => toast.error(`Gagal menyimpan "${key}"`),
      })
    }
  }

  if (isLoading) {
    return (
      <div className='space-y-4'>
        {BILLING_KEYS.map((k) => <Skeleton key={k} className='h-10 w-full' />)}
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>

        <FormField
          control={form.control}
          name='default_billing_day'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tanggal Tagihan Default</FormLabel>
              <FormControl>
                <Input type='number' min={1} max={28} className='w-24' {...field} />
              </FormControl>
              <FormDescription>
                Tanggal setiap bulan (1–28) saat tagihan baru dibuat secara otomatis.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='invoice_due_days'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Jatuh Tempo Invoice (hari)</FormLabel>
              <FormControl>
                <Input type='number' min={1} className='w-24' {...field} />
              </FormControl>
              <FormDescription>
                Jumlah hari dari tanggal tagihan sampai invoice jatuh tempo.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='isolir_after_days'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Isolir Setelah (hari)</FormLabel>
              <FormControl>
                <Input type='number' min={0} className='w-24' {...field} />
              </FormControl>
              <FormDescription>
                Hari setelah jatuh tempo saat koneksi pelanggan di-isolir. 0 = isolir langsung.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='hard_suspend_after_days'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Suspend Penuh Setelah (hari)</FormLabel>
              <FormControl>
                <Input type='number' min={1} className='w-24' {...field} />
              </FormControl>
              <FormDescription>
                Hari setelah jatuh tempo saat akun pelanggan di-disable sepenuhnya di router.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='isolir_profile_name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Profil Isolir</FormLabel>
              <FormControl>
                <Input placeholder='isolir' {...field} />
              </FormControl>
              <FormDescription>
                Nama profil MikroTik yang dipakai saat pelanggan di-isolir (profil harus sudah ada di router).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type='submit' disabled={isSaving}>
          {isSaving && <Loader2 className='mr-2 size-4 animate-spin' />}
          Simpan
        </Button>
      </form>
    </Form>
  )
}
