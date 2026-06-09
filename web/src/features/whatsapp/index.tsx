import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Loader2, LogOut, RefreshCw, Send, Smartphone } from 'lucide-react'
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
import { Main } from '@/components/layout/main'
import { parseAPIError } from '@/lib/api/errors'
import {
  useLogoutWhatsApp,
  useNotificationSettings,
  useSendWhatsAppTest,
  useUpdateSetting,
  useWhatsAppQR,
  useWhatsAppStatus,
} from './api/queries'
import { type Setting } from './api/schema'

export function WhatsApp() {
  return (
    <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
      <div className='space-y-1'>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
          WhatsApp
        </h2>
        <p className='text-sm text-muted-foreground sm:text-base'>
          Embedded gateway (whatsmeow). Pair a phone via QR to send customer
          notifications.
        </p>
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <ConnectionCard />
        <div className='flex flex-col gap-4'>
          <NotificationSettingsCard />
          <TestMessageCard />
        </div>
      </div>
    </Main>
  )
}

function ConnectionCard() {
  const statusQuery = useWhatsAppStatus()
  const connected = statusQuery.data?.connected ?? false
  const [pairing, setPairing] = useState(false)
  // QR query is gated on (pairing && !connected); once connected the
  // "connected" branch renders, so no effect is needed to stop pairing.
  const qrQuery = useWhatsAppQR(pairing && !connected)
  const logoutMut = useLogoutWhatsApp()

  return (
    <Card>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Smartphone className='size-4' />
          Connection
          {connected ? (
            <Badge variant='online'>connected</Badge>
          ) : (
            <Badge variant='offline'>disconnected</Badge>
          )}
        </CardTitle>
        <CardDescription>
          {connected
            ? `Paired as ${statusQuery.data?.jid || 'unknown'}`
            : 'Not paired. Scan the QR with WhatsApp → Linked devices.'}
        </CardDescription>
      </CardHeader>
      <CardContent className='flex min-h-48 items-center justify-center'>
        {connected ? (
          <div className='text-center text-sm text-muted-foreground'>
            <Smartphone className='mx-auto mb-2 size-10 text-emerald-500' />
            Gateway is online and ready to send messages.
          </div>
        ) : pairing ? (
          qrQuery.isLoading ? (
            <Loader2 className='size-8 animate-spin text-muted-foreground' />
          ) : qrQuery.data?.code ? (
            <div className='flex flex-col items-center gap-3'>
              <div className='rounded-lg bg-white p-3'>
                <QRCodeSVG value={qrQuery.data.code} size={208} />
              </div>
              <p className='text-xs text-muted-foreground'>
                Open WhatsApp → Linked devices → Link a device
              </p>
            </div>
          ) : (
            <div className='text-center text-sm text-muted-foreground'>
              {qrQuery.isError
                ? parseAPIError(qrQuery.error)
                : 'Waiting for QR…'}
            </div>
          )
        ) : (
          <div className='text-center text-sm text-muted-foreground'>
            Click “Connect” to generate a pairing QR.
          </div>
        )}
      </CardContent>
      <CardFooter className='justify-end gap-2'>
        {connected ? (
          <Button
            variant='outline'
            size='sm'
            className='gap-1.5'
            disabled={logoutMut.isPending}
            onClick={() =>
              logoutMut.mutate(undefined, {
                onSuccess: () => toast.success('Logged out'),
                onError: (err) =>
                  toast.error('Logout failed', {
                    description: parseAPIError(err),
                  }),
              })
            }
          >
            {logoutMut.isPending ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <LogOut className='size-4' />
            )}
            Logout
          </Button>
        ) : pairing ? (
          <Button
            variant='outline'
            size='sm'
            className='gap-1.5'
            onClick={() => qrQuery.refetch()}
          >
            <RefreshCw className='size-4' />
            Refresh QR
          </Button>
        ) : (
          <Button size='sm' onClick={() => setPairing(true)}>
            Connect
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

function NotificationSettingsCard() {
  const settingsQuery = useNotificationSettings()

  // Render the form only once settings are loaded so its local state can be
  // initialised directly from props (no seeding effect).
  if (settingsQuery.isLoading || !settingsQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification settings</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
        <CardContent className='flex justify-center py-6'>
          <Loader2 className='size-5 animate-spin text-muted-foreground' />
        </CardContent>
      </Card>
    )
  }

  const waEnabled = settingsQuery.data.find(
    (s) => s.key === 'notification.wa_enabled',
  )
  const adminPhone = settingsQuery.data.find(
    (s) => s.key === 'notification.admin_phone',
  )
  return (
    <NotificationSettingsForm waEnabled={waEnabled} adminPhone={adminPhone} />
  )
}

function NotificationSettingsForm({
  waEnabled,
  adminPhone,
}: {
  waEnabled?: Setting
  adminPhone?: Setting
}) {
  const updateMut = useUpdateSetting()
  const [enabled, setEnabled] = useState(waEnabled?.value === 'true')
  const [phone, setPhone] = useState(adminPhone?.value ?? '')

  const save = () => {
    const ops: Promise<unknown>[] = []
    if (waEnabled && waEnabled.value !== String(enabled)) {
      ops.push(
        updateMut.mutateAsync({
          key: 'notification.wa_enabled',
          value: String(enabled),
        }),
      )
    }
    if (adminPhone && adminPhone.value !== phone.trim()) {
      ops.push(
        updateMut.mutateAsync({
          key: 'notification.admin_phone',
          value: phone.trim(),
        }),
      )
    }
    if (ops.length === 0) {
      toast.info('Nothing to save')
      return
    }
    Promise.all(ops)
      .then(() => toast.success('Settings saved'))
      .catch((err) =>
        toast.error('Failed to save settings', {
          description: parseAPIError(err),
        }),
      )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification settings</CardTitle>
        <CardDescription>
          Toggle WhatsApp delivery and set the admin alert number.
        </CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col gap-4'>
        <div className='flex items-center justify-between rounded-md border px-3 py-2'>
          <div>
            <Label className='text-sm font-medium'>Enable WhatsApp</Label>
            <p className='text-xs text-muted-foreground'>
              When off, all notifications are skipped (still logged).
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={!waEnabled}
          />
        </div>
        <div className='flex flex-col gap-1.5'>
          <Label className='text-xs font-medium text-muted-foreground'>
            Admin phone
          </Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder='08123456789'
            disabled={!adminPhone}
          />
        </div>
      </CardContent>
      <CardFooter className='justify-end'>
        <Button
          size='sm'
          onClick={save}
          disabled={updateMut.isPending}
          className='gap-1.5'
        >
          {updateMut.isPending && <Loader2 className='size-4 animate-spin' />}
          Save
        </Button>
      </CardFooter>
    </Card>
  )
}

function TestMessageCard() {
  const sendMut = useSendWhatsAppTest()
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')

  const send = (e: React.FormEvent) => {
    e.preventDefault()
    if (!phone.trim() || !message.trim()) {
      toast.error('Phone and message are required')
      return
    }
    sendMut.mutate(
      { phone: phone.trim(), message: message.trim() },
      {
        onSuccess: () => toast.success('Test message sent'),
        onError: (err) =>
          toast.error('Failed to send', { description: parseAPIError(err) }),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Send a test message</CardTitle>
        <CardDescription>
          Bypasses templates. Requires a connected gateway.
        </CardDescription>
      </CardHeader>
      <form onSubmit={send}>
        <CardContent className='flex flex-col gap-4'>
          <div className='flex flex-col gap-1.5'>
            <Label className='text-xs font-medium text-muted-foreground'>
              Phone
            </Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder='08123456789'
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label className='text-xs font-medium text-muted-foreground'>
              Message
            </Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
        <CardFooter className='justify-end'>
          <Button
            type='submit'
            size='sm'
            disabled={sendMut.isPending}
            className='gap-1.5'
          >
            {sendMut.isPending ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <Send className='size-4' />
            )}
            Send
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
