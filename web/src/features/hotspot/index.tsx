import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Activity,
  Bell,
  Laptop,
  Loader2,
  PieChart,
  RefreshCw,
  ServerOff,
  Ticket,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import {
  useHotspotActive,
  useHotspotActiveStream,
} from './active/api/queries'
import { useHotspotHosts } from './hosts/api/queries'
import { useHotspotProfiles } from './profiles/api/queries'
import { useHotspotUsers } from './users/api/queries'
import {
  hasExpiredMonitor,
  parseExpiryFromComment,
} from './_shared/derive'
import { routerOSBool } from './_shared/format'

type KPI = {
  title: string
  value: string
  subtitle: React.ReactNode
  icon: React.ElementType
  to: '/hotspot/users' | '/hotspot/profiles' | '/hotspot/active' | '/hotspot/hosts'
  iconClass: string
}

export function HotspotOverview() {
  const routerId = useActiveRouterId()

  // All four resource queries fire in parallel. Each is gated on a
  // valid router ID via the underlying hook's `enabled`.
  const usersQuery = useHotspotUsers(routerId ?? 0)
  const profilesQuery = useHotspotProfiles(routerId ?? 0)
  const activeQuery = useHotspotActive(routerId ?? 0)
  const hostsQuery = useHotspotHosts(routerId ?? 0)
  // Active page owns the SSE feed; mirroring it here so the live dot
  // stays in sync when the overview is the user's first stop.
  const sse = useHotspotActiveStream(routerId ?? 0)

  // Derive the headline numbers without joining users with active
  // sessions — Users page no longer surfaces online/offline, so the
  // overview reflects the same shape.
  //
  // `now` is recomputed every render so expired-count tracks wall time
  // for as long as this page stays mounted. The React Compiler purity
  // rule can't model "intentional time-of-render reads", so we suppress
  // it locally — the value is only used to bucket pre-existing
  // expiry timestamps and never feeds back into render output.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const stats = useMemo(() => {
    const users = usersQuery.data ?? []
    const profiles = profilesQuery.data ?? []
    const active = activeQuery.data ?? []
    const hosts = hostsQuery.data ?? []

    const userCount = users.length
    const disabledCount = users.filter((u) => routerOSBool(u.disabled)).length
    const expiredCount = users.filter((u) => {
      const exp = parseExpiryFromComment(u.comment)
      return exp ? exp.getTime() < now : false
    }).length

    const profileCount = profiles.length
    const monitorCount = profiles.filter((p) => hasExpiredMonitor(p.on_login))
      .length

    const activeCount = active.length

    const hostCount = hosts.length
    const authorizedHosts = hosts.filter((h) => routerOSBool(h.authorized))
      .length

    return {
      userCount,
      disabledCount,
      expiredCount,
      profileCount,
      monitorCount,
      activeCount,
      hostCount,
      authorizedHosts,
    }
  }, [usersQuery.data, profilesQuery.data, activeQuery.data, hostsQuery.data, now])

  const isFetching =
    usersQuery.isFetching ||
    profilesQuery.isFetching ||
    activeQuery.isFetching ||
    hostsQuery.isFetching

  const handleRefresh = () => {
    usersQuery.refetch()
    profilesQuery.refetch()
    activeQuery.refetch()
    hostsQuery.refetch()
    toast.info('Refreshing hotspot resources…')
  }

  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router from the sidebar switcher to view its hotspot status.
        </p>
      </Main>
    )
  }

  const kpis: KPI[] = [
    {
      title: 'Hotspot Users',
      value: String(stats.userCount),
      subtitle: `${stats.disabledCount} disabled · ${stats.expiredCount} expired`,
      icon: Users,
      to: '/hotspot/users',
      iconClass: 'text-sky-600 dark:text-sky-400',
    },
    {
      title: 'Profiles',
      value: String(stats.profileCount),
      subtitle: `${stats.monitorCount} monitor active`,
      icon: PieChart,
      to: '/hotspot/profiles',
      iconClass: 'text-violet-600 dark:text-violet-400',
    },
    {
      title: 'Active Sessions',
      value: String(stats.activeCount),
      subtitle: <LiveSubtitle status={sse.status} />,
      icon: Activity,
      to: '/hotspot/active',
      iconClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Hosts',
      value: String(stats.hostCount),
      subtitle: `${stats.authorizedHosts} authorized`,
      icon: Laptop,
      to: '/hotspot/hosts',
      iconClass: 'text-amber-600 dark:text-amber-400',
    },
  ]

  return (
    <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
            Hotspot Overview
          </h2>
          <p className='text-sm text-muted-foreground sm:text-base'>
            Real-time monitoring of all hotspot resources
          </p>
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={handleRefresh}
          disabled={isFetching}
          className='gap-1.5'
        >
          {isFetching ? (
            <Loader2 className='size-4 animate-spin' />
          ) : (
            <RefreshCw className='size-4' />
          )}
          Refresh
        </Button>
      </div>

      <div className='grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4'>
        {kpis.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Link key={kpi.title} to={kpi.to} className='group block'>
              <Card className='transition-colors group-hover:border-primary/40 group-hover:bg-muted/40'>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-xs font-medium tracking-wide uppercase text-muted-foreground sm:text-sm'>
                    {kpi.title}
                  </CardTitle>
                  <Icon className={`size-5 ${kpi.iconClass}`} />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold tabular-nums sm:text-3xl'>
                    {kpi.value}
                  </div>
                  <p className='text-[11px] text-muted-foreground sm:text-xs'>
                    {kpi.subtitle}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-wrap gap-2'>
          <Button asChild size='sm' className='gap-1.5'>
            <Link to='/voucher/generate'>
              <Ticket className='size-4' />
              Generate Vouchers
            </Link>
          </Button>
          <Button
            variant='outline'
            size='sm'
            className='gap-1.5'
            onClick={() =>
              toast.info('Coming soon', {
                description:
                  'Bulk monitor setup wiring lands in Phase 8.',
              })
            }
          >
            <Bell className='size-4' />
            Setup Expired Monitor
          </Button>
          <Button
            variant='outline'
            size='sm'
            className='gap-1.5'
            onClick={handleRefresh}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <RefreshCw className='size-4' />
            )}
            Refresh All
          </Button>
        </CardContent>
      </Card>
    </Main>
  )
}

// Inline live indicator for the Active Sessions KPI subtitle. Uses a
// dot + label pair instead of a separate component so the subtitle
// stays compact on small screens.
function LiveSubtitle({
  status,
}: {
  status: 'idle' | 'connecting' | 'open' | 'closed'
}) {
  const color =
    status === 'open'
      ? 'bg-emerald-500'
      : status === 'connecting'
        ? 'bg-amber-500'
        : 'bg-muted-foreground/40'
  const label =
    status === 'open'
      ? 'live'
      : status === 'connecting'
        ? 'connecting'
        : 'snapshot'
  return (
    <span className='inline-flex items-center gap-1' title={`SSE: ${status}`}>
      <span
        className={`inline-block size-1.5 rounded-full ${color} ${
          status === 'open' ? 'animate-pulse' : ''
        }`}
      />
      {label}
    </span>
  )
}
