import { useState } from 'react'
import { Bot, CheckCircle2, Info, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { PasswordInput } from '@/components/password-input'
import { parseAPIError } from '@/lib/api/errors'
import {
  useNotifSettings,
  useSendTelegramTest,
  useUpdateSetting,
} from './api/queries'
// import { EventRoutingTable } from './components/event-routing-table'

// Perbedaan kunci Telegram vs WhatsApp:
// - Tidak perlu scan QR. Auth via Bot Token dari @BotFather.
// - Target notifikasi = satu Chat ID (group/channel/user).
// - Tidak bisa fetch daftar kontak via Bot API.
// - Routing event hanya bisa ke "tg_admin" (Chat ID yang dikonfigurasi).

export function TabTelegram() {
  return (
    <div className='space-y-6'>
      {/* Penjelasan Telegram */}
      <Alert>
        <Info className='size-4' />
        <AlertDescription className='text-sm'>
          <strong>Telegram menggunakan Bot API</strong> — berbeda dengan WhatsApp yang perlu scan QR.
          Anda membuat bot via{' '}
          <a href='https://t.me/BotFather' target='_blank' rel='noopener noreferrer'
            className='underline underline-offset-2'>@BotFather
          </a>
          , lalu masukkan bot ke grup/channel tujuan, dan gunakan Chat ID sebagai target.
        </AlertDescription>
      </Alert>

      <div className='grid gap-4 lg:grid-cols-2'>
        <TelegramConfigCard />
        <TelegramTestCard />
      </div>

      {/* Routing per event — disembunyikan sementara, backend tetap aktif
      <Separator />
      <div>
        <div className='mb-3'>
          <h3 className='text-sm font-semibold'>Routing Notifikasi per Event</h3>
          <p className='mt-0.5 text-xs text-muted-foreground'>
            Tambahkan <code className='rounded bg-muted px-1 text-xs'>tg_admin</code> ke event
            yang ingin dikirim ke Telegram. Target lain (WA) tetap bisa ditambahkan di tab WhatsApp.
          </p>
        </div>
        <EventRoutingTable groups={[]} waConnected={false} />
      </div>
      */}
    </div>
  )
}

// ── Konfigurasi Bot ─────────────────────────────────────────────────────

function TelegramConfigCard() {
  const settingsQuery = useNotifSettings()
  const updateMut = useUpdateSetting()

  const settings = settingsQuery.data ?? []
  const tgEnabled = settings.find((s) => s.key === 'notification.telegram_enabled')
  const tgToken = settings.find((s) => s.key === 'notification.telegram_bot_token')
  const tgChatID = settings.find((s) => s.key === 'notification.telegram_chat_id')

  const isMasked = (v?: string) => (v ?? '').startsWith('••')

  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [chatID, setChatID] = useState<string | null>(null)

  const currentEnabled = enabled ?? (tgEnabled?.value === 'true')
  const currentChatID = chatID ?? (tgChatID?.value ?? '')
  const tokenPlaceholder = isMasked(tgToken?.value)
    ? '•••••••• (tersimpan — kosongkan untuk tidak mengubah)'
    : '1234567890:ABCdefGhIJKlmNoPQRsTUVwxYZ'

  function save() {
    const ops: Promise<unknown>[] = []
    if (tgEnabled && String(currentEnabled) !== tgEnabled.value) {
      ops.push(updateMut.mutateAsync({ key: 'notification.telegram_enabled', value: String(currentEnabled) }))
    }
    const tokenVal = token?.trim() ?? ''
    if (tokenVal !== '') {
      ops.push(updateMut.mutateAsync({ key: 'notification.telegram_bot_token', value: tokenVal }))
    }
    if (tgChatID && currentChatID !== tgChatID.value) {
      ops.push(updateMut.mutateAsync({ key: 'notification.telegram_chat_id', value: currentChatID }))
    }
    if (ops.length === 0) { toast.info('Tidak ada perubahan'); return }
    Promise.all(ops)
      .then(() => { toast.success('Konfigurasi Telegram disimpan'); setEnabled(null); setToken(null); setChatID(null) })
      .catch((err) => toast.error('Gagal menyimpan', { description: parseAPIError(err) }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Bot className='size-4 text-blue-500' />
          Konfigurasi Bot
        </CardTitle>
        <CardDescription>
          Token dari @BotFather dan Chat ID tujuan notifikasi admin.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-center justify-between rounded-lg border px-3 py-2.5'>
          <div>
            <Label className='text-sm font-medium'>Aktifkan Telegram</Label>
            <p className='text-xs text-muted-foreground'>
              Kirim notifikasi admin via Telegram Bot.
            </p>
          </div>
          <Switch
            checked={currentEnabled}
            onCheckedChange={setEnabled}
            disabled={!tgEnabled || settingsQuery.isLoading}
          />
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs font-medium text-muted-foreground'>Bot Token</Label>
          <PasswordInput
            value={token ?? ''}
            onChange={(e) => setToken(e.target.value)}
            placeholder={tokenPlaceholder}
            autoComplete='new-password'
            className='font-mono text-sm'
            disabled={settingsQuery.isLoading}
          />
          <p className='text-xs text-muted-foreground'>
            Dari @BotFather. Kosongkan untuk tidak mengubah token yang tersimpan.
          </p>
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs font-medium text-muted-foreground'>Chat ID</Label>
          <Input
            value={currentChatID}
            onChange={(e) => setChatID(e.target.value)}
            placeholder='-100123456789'
            disabled={settingsQuery.isLoading}
          />
          <p className='text-xs text-muted-foreground'>
            ID grup/channel/user Telegram. Gunakan @userinfobot untuk mengetahui ID.
          </p>
        </div>

        {currentEnabled && (tgToken?.value || token) && currentChatID && (
          <div className='flex items-center gap-1.5 text-xs text-emerald-600'>
            <CheckCircle2 className='size-3.5' />
            Konfigurasi tampak lengkap — coba test kirim.
          </div>
        )}
      </CardContent>
      <CardFooter className='justify-end'>
        <Button size='sm' onClick={save} disabled={updateMut.isPending} className='gap-1.5'>
          {updateMut.isPending && <Loader2 className='size-4 animate-spin' />}
          Simpan
        </Button>
      </CardFooter>
    </Card>
  )
}

// ── Test kirim ──────────────────────────────────────────────────────────

function TelegramTestCard() {
  const sendMut = useSendTelegramTest()
  const [message, setMessage] = useState('Ini adalah pesan uji dari Rosmon via Telegram. 🔔')

  function send(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) { toast.error('Pesan wajib diisi'); return }
    sendMut.mutate(
      { message: message.trim() },
      {
        onSuccess: () => toast.success('Pesan uji terkirim ke Telegram'),
        onError: (err) => toast.error('Gagal mengirim', { description: parseAPIError(err) }),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Kirim Pesan Uji</CardTitle>
        <CardDescription>
          Pesan dikirim ke Chat ID yang dikonfigurasi di atas.
        </CardDescription>
      </CardHeader>
      <form onSubmit={send}>
        <CardContent>
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium text-muted-foreground'>Pesan</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
        <CardFooter className='justify-end'>
          <Button type='submit' size='sm' disabled={sendMut.isPending} className='gap-1.5'>
            {sendMut.isPending ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
            Kirim ke Telegram
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
