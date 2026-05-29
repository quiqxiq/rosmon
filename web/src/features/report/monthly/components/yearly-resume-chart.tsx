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
import { SHORT_MONTH_NAMES } from '../../_shared/format'
import { type YearlySummaryRow } from '../index'

type YearlyResumeChartProps = {
  rows: YearlySummaryRow[]
  selectedMonth: number
  onSelectMonth?: (month: number) => void
}

type Datum = {
  monthLabel: string
  monthIndex: number
  total: number
  count: number
}

function compactIDR(value: number): string {
  if (value === 0) return '0'
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return String(value)
}

export function YearlyResumeChart({
  rows,
  selectedMonth,
  onSelectMonth,
}: YearlyResumeChartProps) {
  const data: Datum[] = rows.map((r) => ({
    monthLabel: SHORT_MONTH_NAMES[r.month] ?? String(r.month + 1),
    monthIndex: r.month,
    total: r.total,
    count: r.count,
  }))

  return (
    <div className='h-[220px] w-full'>
      <ResponsiveContainer width='100%' height='100%'>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
          <XAxis
            dataKey='monthLabel'
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
          />
          <Bar
            dataKey='total'
            radius={[3, 3, 0, 0]}
            onClick={(payload) => {
              const datum = (payload as { payload?: Datum })?.payload
              if (onSelectMonth && datum) onSelectMonth(datum.monthIndex)
            }}
            style={{ cursor: onSelectMonth ? 'pointer' : 'default' }}
            shape={(props: unknown) => {
              const p = props as {
                x: number
                y: number
                width: number
                height: number
                payload?: Datum
              }
              const isSelected = p.payload?.monthIndex === selectedMonth
              return (
                <rect
                  x={p.x}
                  y={p.y}
                  width={p.width}
                  height={p.height}
                  rx={3}
                  ry={3}
                  className={
                    isSelected
                      ? 'fill-primary'
                      : 'fill-primary/40'
                  }
                />
              )
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
