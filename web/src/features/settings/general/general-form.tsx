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
  company_name: z.string().max(100),
  hotspot_login_url: z.string().max(255),
})

type FormValues = z.infer<typeof schema>

export function GeneralForm() {
  const { data: settings, isLoading } = useSystemSettings()
  const { mutate: updateSetting, isPending: isSaving } = useUpdateSetting()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { company_name: '', hotspot_login_url: '' },
  })

  useEffect(() => {
    if (!settings) return
    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value
    form.reset({
      company_name: map['general.company_name'] ?? '',
      hotspot_login_url: map['general.hotspot_login_url'] ?? '',
    })
  }, [settings, form])

  function onSubmit(values: FormValues) {
    const entries: { key: string; value: string }[] = [
      { key: 'general.company_name', value: values.company_name },
      { key: 'general.hotspot_login_url', value: values.hotspot_login_url },
    ]
    let done = 0
    let failed = false
    for (const e of entries) {
      updateSetting(e, {
        onSuccess: () => {
          done += 1
          if (done === entries.length && !failed)
            toast.success('Pengaturan umum berhasil disimpan.')
        },
        onError: () => {
          if (!failed) {
            failed = true
            toast.error('Gagal menyimpan pengaturan.')
          }
        },
      })
    }
  }

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-10 w-1/2' />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <FormField
          control={form.control}
          name='company_name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nama Perusahaan</FormLabel>
              <FormControl>
                <Input placeholder='PT. Internet Nusantara' {...field} />
              </FormControl>
              <FormDescription>
                Nama ISP atau perusahaan Anda. Ditampilkan di invoice dan notifikasi pelanggan.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='hotspot_login_url'
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL Login Hotspot</FormLabel>
              <FormControl>
                <Input placeholder='wifi.example.com' {...field} />
              </FormControl>
              <FormDescription>
                Dicetak di voucher sebagai "Login: http://…". Kosongkan jika tidak perlu.
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
