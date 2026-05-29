import { type ColumnDef } from '@tanstack/react-table'
import { ServerOff } from 'lucide-react'
import { useActiveRouterId } from '@/stores/active-router-store'
import { Main } from '@/components/layout/main'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTableColumnHeader, SimpleDataTable } from '@/components/data-table'
import { formatIDR } from '@/lib/format'
import { useSellingSummary, useSellingToday } from './api/queries'
import { type Transaction } from './api/schema'

const columns: ColumnDef<Transaction, unknown>[] = [
  {
    accessorKey: 'username',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Voucher' />
    ),
    cell: ({ row }) => (
      <span className='font-mono font-semibold'>{row.original.username}</span>
    ),
  },
  {
    accessorKey: 'profile',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Profile' />
    ),
    cell: ({ row }) => <span>{row.original.profile || '—'}</span>,
  },
  {
    accessorKey: 'sell_price',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Price' />
    ),
    cell: ({ row }) => (
      <span className='font-medium'>{formatIDR(row.original.sell_price)}</span>
    ),
  },
  {
    accessorKey: 'sale_date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Date' />
    ),
    cell: ({ row }) => (
      <span className='font-mono text-xs'>
        {row.original.sale_date} {row.original.sale_time}
      </span>
    ),
  },
]

function StatCard({
  title,
  value,
  hint,
}: {
  title: string
  value: string
  hint?: string
}) {
  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-xs font-medium text-muted-foreground uppercase tracking-wide'>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className='text-2xl font-bold'>{value}</div>
        {hint ? (
          <p className='text-xs text-muted-foreground'>{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

export function Reports() {
  const routerId = useActiveRouterId()
  const rid = routerId ?? 0
  const today = useSellingToday(rid)
  const summary = useSellingSummary(rid)

  if (routerId == null) {
    return (
      <Main className='flex flex-1 flex-col items-center justify-center gap-3 text-center'>
        <ServerOff className='size-10 text-muted-foreground' />
        <h2 className='text-xl font-bold tracking-tight'>No router selected</h2>
        <p className='max-w-sm text-sm text-muted-foreground'>
          Select a router from the sidebar switcher to view sales reports.
        </p>
      </Main>
    )
  }

  const s = summary.data

  return (
    <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
      <div>
        <h2 className='text-xl font-bold tracking-tight sm:text-2xl'>Reports</h2>
        <p className='text-sm text-muted-foreground'>
          Voucher sales — today and this month.
        </p>
      </div>

      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <StatCard
          title="Today's Sales"
          value={String(today.data?.count ?? 0)}
          hint={today.data?.date}
        />
        <StatCard
          title='Month Count'
          value={String(s?.count ?? 0)}
        />
        <StatCard
          title='Month Revenue'
          value={formatIDR(s?.total_sell_price ?? 0)}
        />
        <StatCard title='Month Profit' value={formatIDR(s?.profit ?? 0)} />
      </div>

      <div>
        <h3 className='mb-2 text-sm font-semibold'>Today's Transactions</h3>
        <SimpleDataTable
          columns={columns}
          data={today.data?.transactions ?? []}
          searchKey='username'
          searchPlaceholder='Search voucher...'
          emptyMessage='No sales today.'
        />
      </div>
    </Main>
  )
}
