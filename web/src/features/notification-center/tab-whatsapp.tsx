import { useState } from 'react'
import {
  CheckCircle2,
  Loader2,
  LogOut,
  Send,
  Smartphone,
  WifiOff,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { parseAPIError } from '@/lib/api/errors'
import {
  useLogoutWhatsApp,
  useNotifSettings,
  useSendWhatsAppTest,
  useUpdateSetting,
  useWhatsAppContacts,
  useWhatsAppGroups,
  useWhatsAppStatus,
} from './api/queries'
import { WaConnectModal } from './components/wa-connect-modal'
import { EventRoutingTable } from './components/event-routing-table'

export function TabWhatsApp() {
  const statusQuery = useWhatsAppStatus()
  const connected = statusQuery.data?.connected ?? false
  const jid = statusQuery.data?.jid ?? ''

  const groupsQuery = useWhatsAppGroups(connected)
  const groups = groupsQuery.data ?? []

  const [connectOpen, setConnectOpen] = useState(false)
  const logoutMut = useLogoutWhatsApp()

  return (
    <div className='space-y-6'>
      {/* ─── Status & Connect ─────────────────────────────────────── */}
      <div className='grid gap-4 lg:grid-cols-2'>
        {/* Connection card */}
        <Card>
          <CardHeader>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Smartphone className='size-4' />
              Status Koneksi
              {connected ? (
                <Badge variant='online' className='ml-auto'>Connected</Badge>
              ) : (
                <Badge variant='offline' className='ml-auto'>Disconnected</Badge>
              )}
            </CardTitle>
            <CardDescription>
              {connected
                ? `Terpasang sebagai ${jid || 'unknown'}`
                : 'Belum terpasang. Klik Connect untuk scan QR.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {connected ? (
              <div className='flex items-center gap-3 rounded-lg bg-emerald-50 p-3 dark:bg-emerald-950/30'>
                <CheckCircle2 className='size-5 flex-none text-emerald-500' />
                <div className='min-w-0'>
                  <p className='text-sm font-medium text-emerald-700 dark:text-emerald-400'>
                    Gateway aktif
                  </p>
                  <p className='truncate text-xs text-emerald-600/80 dark:text-emerald-500/80'>
                    {jid}
                  </p>
                </div>
              </div>
            ) : (
              <div className='flex items-center gap-3 rounded-lg bg-muted/50 p-3'>
                <WifiOff className='size-5 flex-none text-muted-foreground' />
                <p className='text-sm text-muted-foreground'>
                  Koneksi belum aktif. Notifikasi WA tidak akan terkirim.
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className='gap-2'>
            {connected ? (
              <Button
                variant='outline'
                size='sm'
                className='gap-1.5'
                disabled={logoutMut.isPending}
                onClick={() =>
                  logoutMut.mutate(undefined, {
                    onSuccess: () => toast.success('Berhasil logout'),
                    onError: (err) => toast.error(parseAPIError(err)),
                  })
                }
              >
                {logoutMut.isPending && <Loader2 className='size-4 animate-spin' />}
                <LogOut className='size-4' />
                Cabut Perangkat
              </Button>
            ) : (
              <Button size='sm' onClick={() => setConnectOpen(true)}>
                Hubungkan
              </Button>
            )}
            {connected && (
              <Button variant='ghost' size='sm' className='gap-1.5 text-muted-foreground'
                onClick={() => groupsQuery.refetch()}>
                <Users className='size-4' />
                {groups.length} grup
              </Button>
            )}
          </CardFooter>
        </Card>

        {/* Notification settings card */}
        <WaSettingsCard />
      </div>

      {/* ─── Test Send ─────────────────────────────────────────────── */}
      <WaTestCard connected={connected} groups={groups} />

      {/* Routing per event — disembunyikan sementara, backend tetap aktif
      <Separator />
      <div>
        <div className='mb-3'>
          <h3 className='text-sm font-semibold'>Routing Notifikasi per Event</h3>
          <p className='mt-0.5 text-xs text-muted-foreground'>
            Pilih siapa yang menerima notifikasi untuk setiap jenis kejadian.
          </p>
        </div>
        <EventRoutingTable groups={groups} waConnected={connected} />
      </div>
      */}

      <WaConnectModal open={connectOpen} onOpenChange={setConnectOpen} />
    </div>
  )
}

// ── Settings card ───────────────────────────────────────────────────────

function WaSettingsCard() {
  const settingsQuery = useNotifSettings()
  const updateMut = useUpdateSetting()

  const settings = settingsQuery.data ?? []
  const waEnabled = settings.find((s) => s.key === 'notification.wa_enabled')
  const adminPhone = settings.find((s) => s.key === 'notification.admin_phone')

  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [phone, setPhone] = useState<string | null>(null)

  const currentEnabled = enabled ?? (waEnabled?.value === 'true')
  const currentPhone = phone ?? (adminPhone?.value ?? '')

  function save() {
    const ops: Promise<unknown>[] = []
    if (waEnabled && String(currentEnabled) !== waEnabled.value) {
      ops.push(updateMut.mutateAsync({ key: 'notification.wa_enabled', value: String(currentEnabled) }))
    }
    if (adminPhone && currentPhone !== adminPhone.value) {
      ops.push(updateMut.mutateAsync({ key: 'notification.admin_phone', value: currentPhone }))
    }
    if (ops.length === 0) { toast.info('Tidak ada perubahan'); return }
    Promise.all(ops)
      .then(() => { toast.success('Pengaturan disimpan'); setEnabled(null); setPhone(null) })
      .catch((err) => toast.error('Gagal menyimpan', { description: parseAPIError(err) }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Pengaturan WhatsApp</CardTitle>
        <CardDescription>
          Aktifkan pengiriman dan set nomor admin untuk alert internal.
        </CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-center justify-between rounded-lg border px-3 py-2.5'>
          <div>
            <Label className='text-sm font-medium'>Aktifkan WhatsApp</Label>
            <p className='text-xs text-muted-foreground'>
              Jika off, semua notifikasi dilewati (tetap dicatat).
            </p>
          </div>
          <Switch
            checked={currentEnabled}
            onCheckedChange={setEnabled}
            disabled={!waEnabled || settingsQuery.isLoading}
          />
        </div>
        <div className='space-y-1.5'>
          <Label className='text-xs font-medium text-muted-foreground'>
            Nomor Admin (format: 628xxx)
          </Label>
          <Input
            value={currentPhone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder='628123456789'
            disabled={!adminPhone || settingsQuery.isLoading}
          />
          <p className='text-xs text-muted-foreground'>
            Menerima alert sistem (eskalasi, registrasi baru).
          </p>
        </div>
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

// ── Test send card ──────────────────────────────────────────────────────

interface WaTestCardProps {
  connected: boolean
  groups: { jid: string; name: string }[]
}

function WaTestCard({ connected }: WaTestCardProps) {
  const sendMut = useSendWhatsAppTest()
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('Ini adalah pesan uji dari Rosmon. 🔔')

  function send(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim() || !message.trim()) {
      toast.error('Nomor dan pesan wajib diisi')
      return
    }
    sendMut.mutate(
      { phone: phone.trim(), message: message.trim() },
      {
        onSuccess: () => toast.success('Pesan uji terkirim'),
        onError: (err) => toast.error('Gagal mengirim', { description: parseAPIError(err) }),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>Kirim Pesan Uji</CardTitle>
        <CardDescription>
          Kirim pesan langsung ke nomor tertentu (bypass template).
          {!connected && (
            <span className='ml-1 text-amber-500'>
              WhatsApp belum terhubung — hubungkan terlebih dahulu.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <form onSubmit={send}>
        <CardContent className='grid gap-4 sm:grid-cols-2'>
          <div className='space-y-1.5'>
            <Label className='text-xs font-medium text-muted-foreground'>
              Nomor tujuan (format: 628xxx)
            </Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder='628123456789'
              disabled={!connected}
            />
          </div>
          <div className='space-y-1.5 sm:row-span-2'>
            <Label className='text-xs font-medium text-muted-foreground'>Pesan</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              disabled={!connected}
            />
          </div>
        </CardContent>
        <CardFooter className='justify-end'>
          <Button type='submit' size='sm' disabled={!connected || sendMut.isPending} className='gap-1.5'>
            {sendMut.isPending ? <Loader2 className='size-4 animate-spin' /> : <Send className='size-4' />}
            Kirim Test
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
