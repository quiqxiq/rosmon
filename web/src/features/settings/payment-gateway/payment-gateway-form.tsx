import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  CheckCircle2,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
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
import { useSystemSettings, useTestPaymentGateway, useUpdateSetting } from './api/queries'

// ── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  xendit_enabled: z.boolean(),
  xendit_secret_key: z.string(),
  xendit_webhook_token: z.string(),
  xendit_invoice_duration: z
    .string()
    .regex(/^\d+$/, 'Harus berupa angka')
    .refine((v) => Number(v) >= 300, { message: 'Minimal 300 detik (5 menit)' }),
  app_url: z
    .string()
    .refine(
      (v) => v === '' || /^https?:\/\//.test(v),
      { message: 'Harus URL valid (diawali http:// atau https://)' },
    ),
})

type FormValues = z.infer<typeof schema>

// ── Helpers ──────────────────────────────────────────────────────────────────

const XENDIT_KEYS = [
  'payment.xendit_enabled',
  'payment.xendit_secret_key',
  'payment.xendit_webhook_token',
  'payment.xendit_invoice_duration',
  'payment.app_url',
] as const

/** Apakah value adalah masked secret (server mengisi "••••••••") */
function isMasked(value: string) {
  return value.startsWith('••')
}

// ── Component ────────────────────────────────────────────────────────────────

type TestStatus = 'idle' | 'success' | 'error'

export function PaymentGatewayForm() {
  const { data: settings, isLoading } = useSystemSettings()
  const { mutate: updateSetting, isPending: isSaving } = useUpdateSetting()
  const { mutate: testGateway, isPending: isTesting } = useTestPaymentGateway()

  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testMessage, setTestMessage] = useState('')

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      xendit_enabled: false,
      xendit_secret_key: '',
      xendit_webhook_token: '',
      xendit_invoice_duration: '86400',
      app_url: '',
    },
  })

  // Sinkronkan form saat settings dari server tiba.
  useEffect(() => {
    if (!settings) return
    const pgSettings = settings.filter((s) => XENDIT_KEYS.includes(s.key as typeof XENDIT_KEYS[number]))
    const map: Record<string, string> = {}
    for (const s of pgSettings) map[s.key] = s.value

    form.reset({
      xendit_enabled: map['payment.xendit_enabled'] === 'true',
      // Jika nilai masked, biarkan kosong agar user harus isi ulang jika mau ganti.
      // Placeholder akan menunjukkan bahwa nilai sudah tersimpan.
      xendit_secret_key: isMasked(map['payment.xendit_secret_key'] ?? '') ? '' : (map['payment.xendit_secret_key'] ?? ''),
      xendit_webhook_token: isMasked(map['payment.xendit_webhook_token'] ?? '') ? '' : (map['payment.xendit_webhook_token'] ?? ''),
      xendit_invoice_duration: map['payment.xendit_invoice_duration'] || '86400',
      app_url: map['payment.app_url'] ?? '',
    })
  }, [settings, form])

  function getSecretPlaceholder(key: string) {
    const s = settings?.find((x) => x.key === key)
    if (s && isMasked(s.value)) return '••••••••  (tersimpan, kosongkan untuk tidak mengubah)'
    return ''
  }

  function onSubmit(values: FormValues) {
    const updates: { key: string; value: string }[] = [
      { key: 'payment.xendit_enabled', value: values.xendit_enabled ? 'true' : 'false' },
      { key: 'payment.xendit_invoice_duration', value: values.xendit_invoice_duration },
      { key: 'payment.app_url', value: values.app_url },
    ]
    // Hanya update secret jika diisi (bukan placeholder kosong karena masked)
    if (values.xendit_secret_key.trim() !== '') {
      updates.push({ key: 'payment.xendit_secret_key', value: values.xendit_secret_key })
    }
    if (values.xendit_webhook_token.trim() !== '') {
      updates.push({ key: 'payment.xendit_webhook_token', value: values.xendit_webhook_token })
    }

    let done = 0
    for (const { key, value } of updates) {
      updateSetting({ key, value }, {
        onSuccess: () => {
          done++
          if (done === updates.length) {
            toast.success('Konfigurasi payment gateway berhasil disimpan.')
            setTestStatus('idle')
          }
        },
        onError: () => {
          toast.error(`Gagal menyimpan pengaturan "${key}"`)
        },
      })
    }
  }

  function handleTestConnection() {
    setTestStatus('idle')
    setTestMessage('')
    testGateway(undefined, {
      onSuccess: (result) => {
        setTestStatus(result.success ? 'success' : 'error')
        setTestMessage(result.message)
      },
      onError: () => {
        setTestStatus('error')
        setTestMessage('Gagal menghubungi server. Coba lagi.')
      },
    })
  }

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-10 w-full' />
        <Skeleton className='h-10 w-2/3' />
      </div>
    )
  }

  const isConfigured = settings?.some(
    (s) => s.key === 'payment.xendit_secret_key' && isMasked(s.value),
  )

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>

        {/* Status Badge */}
        <div className='flex items-center gap-2'>
          {isConfigured ? (
            <Badge variant='default' className='gap-1.5 bg-green-600 hover:bg-green-600'>
              <CheckCircle2 className='size-3.5' />
              Terkonfigurasi
            </Badge>
          ) : (
            <Badge variant='secondary' className='gap-1.5'>
              <XCircle className='size-3.5' />
              Belum Dikonfigurasi
            </Badge>
          )}
          <span className='text-xs text-muted-foreground'>
            Xendit Sandbox: key dimulai xnd_development_ · Production: xnd_production_
          </span>
        </div>

        {/* Enable toggle */}
        <FormField
          control={form.control}
          name='xendit_enabled'
          render={({ field }) => (
            <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
              <div className='space-y-0.5'>
                <FormLabel className='text-base'>Aktifkan Xendit</FormLabel>
                <FormDescription>
                  Tampilkan tombol "Bayar Online" di portal pelanggan.
                  Secret key harus sudah diisi sebelum mengaktifkan.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  id='xendit-enabled-switch'
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        {/* Secret Key */}
        <FormField
          control={form.control}
          name='xendit_secret_key'
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Secret Key</FormLabel>
              <FormControl>
                <PasswordInput
                  id='xendit-secret-key-input'
                  autoComplete='new-password'
                  placeholder={getSecretPlaceholder('payment.xendit_secret_key') || 'xnd_production_xxxxx...'}
                  className='font-mono text-sm'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Dari{' '}
                <a
                  href='https://dashboard.xendit.co/settings/developers#api-keys'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary underline underline-offset-2'
                >
                  Xendit Dashboard → API Keys
                </a>
                . Kosongkan jika tidak ingin mengubah nilai yang tersimpan.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Webhook Token */}
        <FormField
          control={form.control}
          name='xendit_webhook_token'
          render={({ field }) => (
            <FormItem>
              <FormLabel>X-CALLBACK-TOKEN</FormLabel>
              <FormControl>
                <PasswordInput
                  id='xendit-webhook-token-input'
                  autoComplete='new-password'
                  placeholder={getSecretPlaceholder('payment.xendit_webhook_token') || 'Token dari Xendit Settings → Webhooks'}
                  className='font-mono text-sm'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Token untuk memvalidasi bahwa webhook berasal dari Xendit.
                Dari{' '}
                <a
                  href='https://dashboard.xendit.co/settings/developers#webhooks'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary underline underline-offset-2'
                >
                  Xendit Dashboard → Webhooks
                </a>
                .
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Invoice Duration */}
        <FormField
          control={form.control}
          name='xendit_invoice_duration'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Durasi Link Pembayaran (detik)</FormLabel>
              <FormControl>
                <Input
                  id='xendit-invoice-duration-input'
                  type='number'
                  min={300}
                  max={86400}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Berapa lama link checkout Xendit berlaku. 86400 = 24 jam, 3600 = 1 jam.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* App URL */}
        <FormField
          control={form.control}
          name='app_url'
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL Publik Aplikasi</FormLabel>
              <FormControl>
                <Input
                  id='app-url-input'
                  type='url'
                  placeholder='https://isp.example.com'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                URL yang dipakai untuk redirect setelah pembayaran. Contoh:{' '}
                <code className='text-xs'>https://billing.myisp.co.id</code>.
                Untuk dev lokal, gunakan{' '}
                <a
                  href='https://ngrok.com'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary underline underline-offset-2'
                >
                  ngrok
                </a>
                .
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        {/* Webhook URL info */}
        <div className='rounded-lg border bg-muted/50 p-4 space-y-1'>
          <p className='text-sm font-medium'>URL Webhook Xendit</p>
          <p className='text-xs text-muted-foreground'>
            Daftarkan URL berikut di{' '}
            <a
              href='https://dashboard.xendit.co/settings/developers#webhooks'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary underline underline-offset-2'
            >
              Xendit Dashboard → Webhooks
            </a>
            :
          </p>
          <code className='block text-xs bg-background rounded border px-2 py-1 font-mono break-all select-all'>
            {form.watch('app_url') || 'https://isp.example.com'}/api/v1/public/webhooks/xendit
          </code>
          <p className='text-xs text-muted-foreground'>
            Event yang harus dicentang: <strong>Invoice paid</strong>, <strong>Invoice expired</strong>
          </p>
        </div>

        {/* Test Connection Result */}
        {testStatus !== 'idle' && (
          <Alert variant={testStatus === 'success' ? 'default' : 'destructive'}>
            {testStatus === 'success'
              ? <CheckCircle2 className='size-4' />
              : <XCircle className='size-4' />
            }
            <AlertDescription>{testMessage}</AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className='flex flex-wrap items-center gap-3'>
          <Button
            id='save-payment-gateway-btn'
            type='submit'
            disabled={isSaving}
          >
            {isSaving && <Loader2 className='mr-2 size-4 animate-spin' />}
            Simpan Pengaturan
          </Button>

          <Button
            id='test-payment-gateway-btn'
            type='button'
            variant='outline'
            disabled={isTesting || isSaving}
            onClick={handleTestConnection}
          >
            {isTesting
              ? <Loader2 className='mr-2 size-4 animate-spin' />
              : <RefreshCw className='mr-2 size-4' />
            }
            Test Koneksi Xendit
          </Button>
        </div>

        <p className='text-xs text-muted-foreground'>
          Secret key <strong>tidak ditampilkan</strong> setelah disimpan (hanya indikator "tersimpan").
          Untuk mengganti, isi field baru dan simpan.
        </p>
      </form>
    </Form>
  )
}
