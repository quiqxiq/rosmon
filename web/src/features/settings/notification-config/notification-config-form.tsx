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
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { PasswordInput } from '@/components/password-input'
import { useSystemSettings, useUpdateSetting } from '../api/queries'

const schema = z.object({
  wa_enabled: z.boolean(),
  admin_phone: z.string(),
  telegram_enabled: z.boolean(),
  telegram_bot_token: z.string(),
  telegram_chat_id: z.string(),
})

type FormValues = z.infer<typeof schema>

const NOTIF_KEYS = [
  'notification.wa_enabled',
  'notification.admin_phone',
  'notification.telegram_enabled',
  'notification.telegram_bot_token',
  'notification.telegram_chat_id',
] as const

function isMasked(value: string) {
  return value.startsWith('••')
}

export function NotificationConfigForm() {
  const { data: settings, isLoading } = useSystemSettings()
  const { mutate: updateSetting, isPending: isSaving } = useUpdateSetting()

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      wa_enabled: false,
      admin_phone: '',
      telegram_enabled: false,
      telegram_bot_token: '',
      telegram_chat_id: '',
    },
  })

  useEffect(() => {
    if (!settings) return
    const map: Record<string, string> = {}
    for (const s of settings) map[s.key] = s.value
    form.reset({
      wa_enabled: map['notification.wa_enabled'] === 'true',
      admin_phone: map['notification.admin_phone'] ?? '',
      telegram_enabled: map['notification.telegram_enabled'] === 'true',
      telegram_bot_token: isMasked(map['notification.telegram_bot_token'] ?? '') ? '' : (map['notification.telegram_bot_token'] ?? ''),
      telegram_chat_id: map['notification.telegram_chat_id'] ?? '',
    })
  }, [settings, form])

  function getBotTokenPlaceholder() {
    const s = settings?.find((x) => x.key === 'notification.telegram_bot_token')
    if (s && isMasked(s.value)) return '••••••••  (tersimpan, kosongkan untuk tidak mengubah)'
    return '1234567890:ABCdefGhIJKlmNoPQRsTUVwxYZ'
  }

  function onSubmit(values: FormValues) {
    const updates: { key: string; value: string }[] = [
      { key: 'notification.wa_enabled', value: values.wa_enabled ? 'true' : 'false' },
      { key: 'notification.admin_phone', value: values.admin_phone },
      { key: 'notification.telegram_enabled', value: values.telegram_enabled ? 'true' : 'false' },
      { key: 'notification.telegram_chat_id', value: values.telegram_chat_id },
    ]
    if (values.telegram_bot_token.trim() !== '') {
      updates.push({ key: 'notification.telegram_bot_token', value: values.telegram_bot_token })
    }

    let done = 0
    for (const { key, value } of updates) {
      updateSetting({ key, value }, {
        onSuccess: () => {
          done++
          if (done === updates.length) {
            toast.success('Konfigurasi notifikasi berhasil disimpan.')
          }
        },
        onError: () => toast.error(`Gagal menyimpan "${key}"`),
      })
    }
  }

  if (isLoading) {
    return (
      <div className='space-y-4'>
        {NOTIF_KEYS.map((k) => <Skeleton key={k} className='h-10 w-full' />)}
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>

        {/* WhatsApp Section */}
        <div className='space-y-4'>
          <h4 className='text-sm font-semibold'>WhatsApp</h4>

          <FormField
            control={form.control}
            name='wa_enabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>Aktifkan WhatsApp</FormLabel>
                  <FormDescription>
                    Kirim notifikasi jatuh tempo dan status layanan via WhatsApp.
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
            name='admin_phone'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nomor Admin</FormLabel>
                <FormControl>
                  <Input placeholder='628123456789' {...field} />
                </FormControl>
                <FormDescription>
                  Nomor WhatsApp admin (format internasional tanpa +). Menerima alert internal seperti eskalasi outbox.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Separator />

        {/* Telegram Section */}
        <div className='space-y-4'>
          <h4 className='text-sm font-semibold'>Telegram</h4>

          <FormField
            control={form.control}
            name='telegram_enabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>Aktifkan Telegram</FormLabel>
                  <FormDescription>
                    Kirim notifikasi ke Telegram Bot. Bot token dan Chat ID harus sudah diisi.
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
            name='telegram_bot_token'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bot Token</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete='new-password'
                    placeholder={getBotTokenPlaceholder()}
                    className='font-mono text-sm'
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Token dari @BotFather. Kosongkan jika tidak ingin mengubah nilai yang tersimpan.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='telegram_chat_id'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Chat ID</FormLabel>
                <FormControl>
                  <Input placeholder='-100123456789' {...field} />
                </FormControl>
                <FormDescription>
                  ID grup atau channel Telegram tujuan notifikasi. Gunakan @userinfobot untuk mengetahui ID.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type='submit' disabled={isSaving}>
          {isSaving && <Loader2 className='mr-2 size-4 animate-spin' />}
          Simpan
        </Button>
      </form>
    </Form>
  )
}
