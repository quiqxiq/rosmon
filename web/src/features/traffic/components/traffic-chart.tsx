import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatBitsPerSecond } from '@/lib/format'
import { type TrafficMode, type TrafficSample } from '../data/schema'

type TrafficChartProps = {
  samples: TrafficSample[]
  mode: TrafficMode
}

type ChartDatum = {
  timestamp: number
  rx: number
  tx: number
}

const liveTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

const historyTimeFormatter = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
})

function formatTick(ts: number, mode: TrafficMode): string {
  return mode === 'live'
    ? liveTimeFormatter.format(ts)
    : historyTimeFormatter.format(ts)
}

export function TrafficChart({ samples, mode }: TrafficChartProps) {
  const data: ChartDatum[] = samples.map((s) => ({
    timestamp: s.timestamp,
    rx: s.rxBps,
    tx: s.txBps,
  }))

  const tickInterval = mode === 'live' ? 8 : Math.floor(samples.length / 8)

  return (
    <div className='h-[360px] w-full'>
      <ResponsiveContainer width='100%' height='100%'>
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id='rxFill' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='5%' stopColor='#0ea5e9' stopOpacity={0.4} />
              <stop offset='95%' stopColor='#0ea5e9' stopOpacity={0} />
            </linearGradient>
            <linearGradient id='txFill' x1='0' y1='0' x2='0' y2='1'>
              <stop offset='5%' stopColor='#a855f7' stopOpacity={0.4} />
              <stop offset='95%' stopColor='#a855f7' stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray='3 3' className='stroke-muted' />
          <XAxis
            dataKey='timestamp'
            type='number'
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => formatTick(v, mode)}
            interval={tickInterval}
            stroke='#888888'
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v: number) => formatBitsPerSecond(v)}
            stroke='#888888'
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 12,
            }}
            labelFormatter={(label) => formatTick(Number(label), mode)}
            formatter={(value, name) => [
              formatBitsPerSecond(Number(value) || 0),
              String(name) === 'rx' ? 'RX' : 'TX',
            ]}
          />
          <Area
            type='monotone'
            dataKey='rx'
            stroke='#0ea5e9'
            fill='url(#rxFill)'
            strokeWidth={2}
            isAnimationActive={mode === 'history'}
          />
          <Area
            type='monotone'
            dataKey='tx'
            stroke='#a855f7'
            fill='url(#txFill)'
            strokeWidth={2}
            isAnimationActive={mode === 'history'}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
