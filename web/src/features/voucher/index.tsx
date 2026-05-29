import { Link } from '@tanstack/react-router'
import {
  BarChart3,
  CalendarDays,
  ListOrdered,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  ServerOff,
  Ticket,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { useQuickPrintPackages } from '@/features/voucher/print/api/queries'
import {
  useDailyReport,
  useDashboardSummary,
} from '@/features/voucher/sales/api/queries'
import { useActiveRouterId } from '@/stores/active-router-store'
import { formatIDR } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Main } from '@/components/layout/main'

type KPI = {
  title: string
  value: string
  subtitle: string
  icon: React.ElementType
  to: string
  iconClass: string
}

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  dateStyle: 'short',
  timeStyle: 'short',
})

// Backend's DailyReport endpoint expects YYYY-MM-DD; this matches the
// canonical date key used by RouterOS sale-record names too.
function todayIsoDate(): string {
  const d = new Date()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

const RECENT_SALES_LIMIT = 10

export function VoucherOverview() {
  const routerId = useActiveRouterId()
  const today = todayIsoDate()

  // KPI cards driven by /reports/summary (server-computed totals).
  const summaryQuery = useDashboardSummary(routerId ?? 0)
  // Recent sales table driven by today's daily report; sliced client-side
  // because the backend has no `limit` param on this endpoint.
  const dailyQuery = useDailyReport(routerId ?? 0, today)
  // Quick-preset count for the 4th KPI card.
  const presetsQuery = useQuickPrintPackages(routerId ?? 0)

  // No-router-selected — every query above is gated on routerId > 0,
  // so without a router this page is just a CTA to pick one.
  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router from the sidebar switcher to view its voucher sales
          summary.
        </p>
      </Main>
    )
  }

  const summary = summaryQuery.data
  const recent = (dailyQuery.data?.sales ?? []).slice(0, RECENT_SALES_LIMIT)
  const presetCount = presetsQuery.data?.length ?? 0
  const isFetching =
    summaryQuery.isFetching || dailyQuery.isFetching || presetsQuery.isFetching

  const kpis: KPI[] = [
    {
      title: "Today's Sales",
      value: String(summary?.today_count ?? 0),
      subtitle: formatIDR(summary?.today_sum ?? 0),
      icon: TrendingUp,
      to: '/voucher/generate',
      iconClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'This Month',
      value: String(summary?.month_count ?? 0),
      subtitle: formatIDR(summary?.month_sum ?? 0),
      icon: CalendarDays,
      to: '/report/monthly',
      iconClass: 'text-sky-600 dark:text-sky-400',
    },
    {
      // The backend doesn't expose an "all-time total" KPI. Repurposing
      // this card to track today's price totals — keeps the 4-card grid
      // and surfaces another useful number without a new endpoint.
      title: 'Today Revenue',
      value: formatIDR(summary?.today_sum ?? 0),
      subtitle: `${summary?.today_count ?? 0} voucher${summary?.today_count === 1 ? '' : 's'}`,
      icon: BarChart3,
      to: '/report/daily',
      iconClass: 'text-violet-600 dark:text-violet-400',
    },
    {
      title: 'Quick Presets',
      value: String(presetCount),
      subtitle: 'configured',
      icon: Printer,
      to: '/voucher/print',
      iconClass: 'text-amber-600 dark:text-amber-400',
    },
  ]

  const handleRefresh = () => {
    summaryQuery.refetch()
    dailyQuery.refetch()
    presetsQuery.refetch()
    toast.info('Refreshing voucher data…')
  }

  return (
    <Main className='flex flex-1 flex-col gap-3 sm:gap-6'>
      <div className='flex flex-wrap items-end justify-between gap-2'>
        <div>
          <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>
            Voucher Overview
          </h2>
          <p className='text-sm text-muted-foreground sm:text-base'>
            Sales summary and recent voucher activity
          </p>
        </div>
        <Button
          variant='outline'
          size='sm'
          onClick={handleRefresh}
          disabled={isFetching}
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
              <Plus className='size-4' />
              Generate Vouchers
            </Link>
          </Button>
          <Button asChild variant='outline' size='sm' className='gap-1.5'>
            <Link to='/voucher/print'>
              <Printer className='size-4' />
              Quick Print Presets
            </Link>
          </Button>
          <Button asChild variant='outline' size='sm' className='gap-1.5'>
            <Link to='/voucher/sales'>
              <ListOrdered className='size-4' />
              Sales History
            </Link>
          </Button>
          <Button asChild variant='outline' size='sm' className='gap-1.5'>
            <Link to='/report/daily'>
              <BarChart3 className='size-4' />
              View Reports
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-start justify-between gap-2 space-y-0'>
          <div className='space-y-1'>
            <CardTitle className='text-base'>Recent Sales</CardTitle>
            <p className='text-xs text-muted-foreground'>
              {dailyQuery.isLoading
                ? 'Loading today’s sales…'
                : `Today’s sales — showing latest ${recent.length}`}
            </p>
          </div>
          <Button asChild variant='ghost' size='sm' className='gap-1.5'>
            <Link to='/voucher/sales'>
              View all
              <ListOrdered className='size-4' />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className='overflow-x-auto rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sold At</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead className='text-right'>Price</TableHead>
                  <TableHead>Server</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyQuery.isError ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className='h-24 text-center text-destructive'
                    >
                      Failed to load sales. Click Refresh to retry.
                    </TableCell>
                  </TableRow>
                ) : recent.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className='h-24 text-center text-muted-foreground'
                    >
                      <Ticket className='mx-auto mb-1 size-5 opacity-50' />
                      {dailyQuery.isLoading ? 'Loading…' : 'No recent sales.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  recent.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className='font-mono text-xs'>
                        {dateFormatter.format(new Date(sale.sold_at))}
                      </TableCell>
                      <TableCell className='font-mono text-sm font-semibold'>
                        {sale.username}
                      </TableCell>
                      <TableCell className='text-sm'>
                        {sale.profile_name}
                      </TableCell>
                      <TableCell className='text-right font-mono text-sm tabular-nums text-emerald-600 dark:text-emerald-400'>
                        {formatIDR(sale.selling_price)}
                      </TableCell>
                      <TableCell className='font-mono text-xs'>
                        {sale.server}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </Main>
  )
}
