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
import { Switch } from '@/components/ui/switch'
import { useSystemSettings, useUpdateSetting } from '../api/queries'

const schema = z.object({
  enabled: z.boolean(),
  path: z.string().min(1, 'Wajib diisi'),
  retention_days: z
    .string()
    .regex(/^\d+$/, 'Harus berupa angka')
    .refine((v) => +v >= 1, { message: 'Minimal 1 hari' }),
})

type FormValues = z.infer<typeof schema>

const BACKUP_KEYS = [
  'backup.enabled',
  'backup.path',
  'backup.retention_days',
] as const

export function BackupForm() {
  const { data: settings, isLoading } = useSystemSettings()
  const { mutate: updateSetting, isPending: isSaving } = useUpdateSetting()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      enabled: false,
      path: './backups',
      retention_days: '7',
    },
  })

  useEffect(() => {
    if (!settings) return
    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value
    form.reset({
      enabled: map['backup.enabled'] === 'true',
      path: map['backup.path'] ?? './backups',
      retention_days: map['backup.retention_days'] ?? '7',
    })
  }, [settings, form])

  function onSubmit(values: FormValues) {
    const updates: { key: string; value: string }[] = [
      { key: 'backup.enabled', value: values.enabled ? 'true' : 'false' },
      { key: 'backup.path', value: values.path },
      { key: 'backup.retention_days', value: values.retention_days },
    ]
    let done = 0
    for (const { key, value } of updates) {
      updateSetting({ key, value }, {
        onSuccess: () => {
          done++
          if (done === updates.length) {
            toast.success('Konfigurasi backup berhasil disimpan.')
          }
        },
        onError: () => toast.error(`Gagal menyimpan "${key}"`),
      })
    }
  }

  if (isLoading) {
    return (
      <div className='space-y-4'>
        {BACKUP_KEYS.map((k) => <Skeleton key={k} className='h-10 w-full' />)}
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>

        <FormField
          control={form.control}
          name='enabled'
          render={({ field }) => (
            <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
              <div className='space-y-0.5'>
                <FormLabel className='text-base'>Aktifkan Backup Otomatis</FormLabel>
                <FormDescription>
                  Backup konfigurasi router dan database dilakukan setiap hari pukul 03.00.
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='path'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Direktori Output Backup</FormLabel>
              <FormControl>
                <Input placeholder='./backups' {...field} />
              </FormControl>
              <FormDescription>
                Path direktori tempat file backup disimpan di server. Pastikan direktori dapat ditulis.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='retention_days'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Retensi Backup (hari)</FormLabel>
              <FormControl>
                <Input type='number' min={1} className='w-24' {...field} />
              </FormControl>
              <FormDescription>
                File backup lebih lama dari nilai ini akan dihapus otomatis.
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
