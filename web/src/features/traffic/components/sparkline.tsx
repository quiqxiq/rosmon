import { Area, AreaChart, ResponsiveContainer } from 'recharts'
import { type LiveSpark } from '../data/schema'

// Minimal axis-less sparkline for a traffic card (rx green, tx indigo).
export function Sparkline({ data }: { data: LiveSpark[] }) {
  return (
    <ResponsiveContainer width='100%' height={40}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <Area
          type='monotone'
          dataKey='rx'
          stroke='#10b981'
          fill='#10b981'
          fillOpacity={0.15}
          strokeWidth={1.5}
          isAnimationActive={false}
          dot={false}
        />
        <Area
          type='monotone'
          dataKey='tx'
          stroke='#6366f1'
          fill='#6366f1'
          fillOpacity={0.1}
          strokeWidth={1.5}
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
