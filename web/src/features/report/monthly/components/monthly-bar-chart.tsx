import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatIDR } from '@/lib/format'
import { type MonthlyChartRow } from '../index'

type MonthlyBarChartProps = {
  rows: MonthlyChartRow[]
  onSelectDay?: (date: Date) => void
}

type ChartDatum = {
  day: number
  total: number
  count: number
  date: Date
}

function compactIDR(value: number): string {
  if (value === 0) return '0'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return String(value)
}

export function MonthlyBarChart({ rows, onSelectDay }: MonthlyBarChartProps) {
  const data: ChartDatum[] = rows.map((r) => ({
    day: r.date.getDate(),
    total: r.total,
    count: r.count,
    date: r.date,
  }))

  return (
    <div className='h-[280px] w-full'>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
          <XAxis
            dataKey='day'
            stroke='#888888'
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => compactIDR(v)}
            stroke='#888888'
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            contentStyle={{
              backgroundColor: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 12,
            }}
            formatter={(value, name) => {
              if (String(name) === 'total') {
                return [formatIDR(Number(value) || 0), 'Revenue']
              }
              return [String(value), 'Count']
            }}
            labelFormatter={(label) => `Day ${String(label)}`}
          />
          <Bar
            dataKey='total'
            fill='currentColor'
            className='fill-primary'
            radius={[3, 3, 0, 0]}
            onClick={(payload) => {
              const datum = (payload as { payload?: ChartDatum })?.payload
              if (onSelectDay && datum?.date) onSelectDay(datum.date)
            }}
            style={{ cursor: onSelectDay ? 'pointer' : 'default' }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
