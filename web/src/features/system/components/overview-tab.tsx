import { Power, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDeleteButton } from '@/components/confirm-delete-button'
import { formatBytes } from '@/lib/format'
import { parseAPIError } from '@/lib/api/errors'
import {
  useReboot,
  useShutdown,
  useSystemClock,
  useSystemIdentity,
  useSystemLicense,
  useSystemResource,
  useSystemRouterboard,
} from '../api/queries'

function Row({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className='flex items-center justify-between gap-2 py-1 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='font-mono'>{value ?? '—'}</span>
    </div>
  )
}

export function OverviewTab() {
  const routerId = useActiveRouterId() ?? 0
  const role = useAuthStore((s) => s.auth.user?.role)
  const isAdmin = role === 'admin'

  const identity = useSystemIdentity(routerId)
  const resource = useSystemResource(routerId)
  const routerboard = useSystemRouterboard(routerId)
  const clock = useSystemClock(routerId)
  const license = useSystemLicense(routerId)

  const rebootMutation = useReboot(routerId)
  const shutdownMutation = useShutdown(routerId)

  const r = resource.data
  const memUsed = r ? r.total_memory - r.free_memory : 0
  const hddUsed = r ? r.total_hdd_space - r.free_hdd_space : 0

  return (
    <div className='flex flex-col gap-4'>
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>
              {identity.data?.name ?? 'Identity'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Row label='Board' value={r?.board_name} />
            <Row label='Platform' value={r?.platform} />
            <Row label='Version' value={r?.version} />
            <Row label='Architecture' value={r?.architecture_name} />
            <Row label='Uptime' value={r?.uptime} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Resource</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label='CPU load' value={r ? `${r.cpu_load}%` : undefined} />
            <Row label='CPU' value={r?.cpu} />
            <Row
              label='Memory'
              value={
                r
                  ? `${formatBytes(memUsed)} / ${formatBytes(r.total_memory)}`
                  : undefined
              }
            />
            <Row
              label='Disk'
              value={
                r
                  ? `${formatBytes(hddUsed)} / ${formatBytes(r.total_hdd_space)}`
                  : undefined
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Routerboard</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label='Model' value={routerboard.data?.model} />
            <Row label='Serial' value={routerboard.data?.serial_number} />
            <Row label='Firmware' value={routerboard.data?.current_firmware} />
            <Row label='Upgrade' value={routerboard.data?.upgrade_firmware} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Clock</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label='Date' value={clock.data?.date} />
            <Row label='Time' value={clock.data?.time} />
            <Row label='Timezone' value={clock.data?.time_zone_name} />
            <Row label='GMT offset' value={clock.data?.gmt_offset} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>License</CardTitle>
          </CardHeader>
          <CardContent>
            <Row label='Software ID' value={license.data?.software_id} />
            <Row label='Level' value={license.data?.n_level} />
            <Row label='Features' value={license.data?.features} />
          </CardContent>
        </Card>
      </div>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>Power</CardTitle>
          </CardHeader>
          <CardContent className='flex flex-wrap gap-2'>
            <ConfirmDeleteButton
              title='Reboot router?'
              description='The router will reboot and be unreachable for a minute or two.'
              confirmText='Reboot'
              pending={rebootMutation.isPending}
              trigger={
                <Button variant='outline' size='sm' className='gap-1.5'>
                  <RotateCcw className='size-4' />
                  Reboot
                </Button>
              }
              onConfirm={async () => {
                try {
                  await rebootMutation.mutateAsync()
                  toast.success('Reboot issued')
                } catch (err) {
                  toast.error('Failed to reboot', {
                    description: parseAPIError(err),
                  })
                }
              }}
            />
            <ConfirmDeleteButton
              title='Shut down router?'
              description='The router will power off and must be turned back on manually.'
              confirmText='Shut down'
              pending={shutdownMutation.isPending}
              trigger={
                <Button variant='destructive' size='sm' className='gap-1.5'>
                  <Power className='size-4' />
                  Shutdown
                </Button>
              }
              onConfirm={async () => {
                try {
                  await shutdownMutation.mutateAsync()
                  toast.success('Shutdown issued')
                } catch (err) {
                  toast.error('Failed to shut down', {
                    description: parseAPIError(err),
                  })
                }
              }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
