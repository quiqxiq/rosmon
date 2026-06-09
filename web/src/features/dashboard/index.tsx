import { ArrowUp, CreditCard, DollarSign, Users, Wifi } from 'lucide-react'
import { useActiveRouterId } from '@/stores/active-router-store'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Main } from '@/components/layout/main'
import { formatIDR } from '@/lib/format'
import { useHotspotUsers } from '@/features/hotspot/users/api/queries'
import { useHotspotActive } from '@/features/hotspot/active/api/queries'
import { useCustomers } from '@/features/customers/api/queries'
import { useSubscriptions } from '@/features/subscriptions/api/queries'
import { useSellingSummary, useSellingToday } from '@/features/reports/api/queries'

export function Dashboard() {
  const routerId = useActiveRouterId() ?? 0

  const users = useHotspotUsers(routerId)
  const active = useHotspotActive(routerId)
  const today = useSellingToday(routerId)
  const summary = useSellingSummary(routerId)
  const customers = useCustomers()
  const subscriptions = useSubscriptions()

  const todaysSales = today.data?.transactions ?? []
  const todaysRevenue = todaysSales.reduce((sum, t) => sum + t.sell_price, 0)

  const kpiStats = [
    {
      label: 'Active',
      value: routerId ? String((active.data ?? []).length) : '—',
      sub: 'Live hotspot sessions',
      icon: Wifi,
      cls: 'mk-stat-red',
    },
    {
      label: 'Hotspot Users',
      value: routerId ? String((users.data ?? []).length) : '—',
      sub: 'On selected router',
      icon: Users,
      cls: 'mk-stat-amber',
    },
    {
      label: 'Income Today',
      value: routerId ? formatIDR(todaysRevenue) : '—',
      sub: `${todaysSales.length} sales today`,
      icon: DollarSign,
      cls: 'mk-stat-teal',
    },
    {
      label: 'Customers',
      value: String((customers.data ?? []).length),
      sub: 'Registered',
      icon: Users,
      cls: 'mk-stat-rx',
    },
    {
      label: 'Subscriptions',
      value: String((subscriptions.data ?? []).length),
      sub: 'PPPoE + hotspot',
      icon: CreditCard,
      cls: 'mk-stat-tx',
    },
  ]

  return (
    <Main>
      <div className='mb-4 flex items-center justify-between gap-2'>
        <h1 className='text-xl font-bold tracking-tight sm:text-2xl'>
          Dashboard
        </h1>
      </div>

      <div className='space-y-4'>
        <div className='grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5'>
          {kpiStats.map((s) => {
            const Icon = s.icon
            return (
              <div
                key={s.label}
                className={`${s.cls} relative overflow-hidden rounded-xl p-3 text-white shadow-md sm:p-4`}
              >
                <p className='mb-1 text-[10px] font-bold tracking-widest uppercase opacity-75 sm:text-xs'>
                  {s.label}
                </p>
                <p className='text-2xl font-extrabold tracking-tight sm:text-3xl'>
                  {s.value}
                </p>
                <p className='mt-1 text-[11px] opacity-75 sm:text-xs'>{s.sub}</p>
                <Icon className='absolute top-1/2 right-2 size-8 -translate-y-1/2 opacity-20 sm:right-3 sm:size-10' />
              </div>
            )
          })}
        </div>

        <div className='grid grid-cols-1 gap-4 lg:grid-cols-7'>
          <Card className='col-span-1 lg:col-span-3'>
            <CardHeader>
              <CardTitle>This Month</CardTitle>
              <CardDescription>Voucher sales summary</CardDescription>
            </CardHeader>
            <CardContent className='space-y-3'>
              <SummaryRow
                label='Sales count'
                value={routerId ? String(summary.data?.count ?? 0) : '—'}
              />
              <SummaryRow
                label='Revenue'
                value={
                  routerId ? formatIDR(summary.data?.total_sell_price ?? 0) : '—'
                }
              />
              <SummaryRow
                label='Profit'
                value={routerId ? formatIDR(summary.data?.profit ?? 0) : '—'}
                accent
              />
            </CardContent>
          </Card>

          <Card className='col-span-1 lg:col-span-4'>
            <CardHeader>
              <CardTitle>Recent Sales</CardTitle>
              <CardDescription>
                {routerId
                  ? `${todaysSales.length} sales today`
                  : 'Select a router to view sales'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {todaysSales.length === 0 ? (
                <p className='py-6 text-center text-sm text-muted-foreground'>
                  {routerId ? 'No sales today.' : 'No router selected.'}
                </p>
              ) : (
                <div className='space-y-3'>
                  {todaysSales.slice(0, 8).map((t) => (
                    <div key={t.id} className='flex items-center gap-3'>
                      <div className='flex size-9 items-center justify-center rounded-full bg-muted'>
                        <ArrowUp className='size-4 text-emerald-500' />
                      </div>
                      <div className='min-w-0 flex-1'>
                        <p className='truncate text-sm font-medium'>
                          {t.username}
                        </p>
                        <p className='truncate text-xs text-muted-foreground'>
                          {t.profile || '—'} · {t.sale_time}
                        </p>
                      </div>
                      <span className='font-medium'>
                        {formatIDR(t.sell_price)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Main>
  )
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className='flex items-center justify-between'>
      <span className='text-sm text-muted-foreground'>{label}</span>
      <span
        className={
          accent ? 'text-lg font-bold text-emerald-500' : 'font-semibold'
        }
      >
        {value}
      </span>
    </div>
  )
}
