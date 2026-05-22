import { HS_PROFILES } from './hotspot'
import { vid, rand } from './_helpers'

export interface FixtureTransaction {
  id: string
  date: string
  user: string
  profile: string
  price: number
  source: string
  operator: string
}

export const TRANSACTIONS: FixtureTransaction[] = (() => {
  const arr: FixtureTransaction[] = []
  const profiles = HS_PROFILES
  const sources = ['voucher-gen', 'manual', 'pos-app']
  const operators = ['rendra', 'aulia', 'dewa', 'mira']
  for (let i = 0; i < 36; i++) {
    const p = profiles[Math.floor(rand(0, profiles.length))]
    const daysAgo = Math.floor(i / 5)
    const date = new Date(Date.now() - daysAgo * 86400000 - rand(0, 1) * 86400000)
    arr.push({
      id: `T${1000 + i}`,
      date: date.toISOString(),
      user: `voucher-${vid().toLowerCase()}`,
      profile: p.name,
      price: p.price,
      source: sources[i % sources.length],
      operator: operators[i % operators.length],
    })
  }
  return arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})()

export const REVENUE_30D = {
  labels: Array.from({ length: 30 }, (_, i) => `${i + 1}`),
  values: Array.from(
    { length: 30 },
    (_, i) => 200_000 + Math.floor(rand(0, 700_000)) + (i > 25 ? 250_000 : 0),
  ),
}

export interface OperatorPerf {
  name: string
  count: number
  revenue: number
}

export const OPERATORS: OperatorPerf[] = (() => {
  const tally: Record<string, OperatorPerf> = {}
  for (const t of TRANSACTIONS) {
    tally[t.operator] ??= { name: t.operator, count: 0, revenue: 0 }
    tally[t.operator].count++
    tally[t.operator].revenue += t.price
  }
  return Object.values(tally).sort((a, b) => b.revenue - a.revenue)
})()

export interface TopProfile {
  profile: string
  count: number
  avg: number
  total: number
  share: number
}

export const TOP_PROFILES: TopProfile[] = (() => {
  const tally: Record<string, { count: number; total: number }> = {}
  for (const t of TRANSACTIONS) {
    tally[t.profile] ??= { count: 0, total: 0 }
    tally[t.profile].count++
    tally[t.profile].total += t.price
  }
  const grand = Object.values(tally).reduce((a, b) => a + b.total, 0)
  return Object.entries(tally)
    .map(([profile, { count, total }]) => ({
      profile,
      count,
      avg: Math.round(total / count),
      total,
      share: Math.round((total / grand) * 100),
    }))
    .sort((a, b) => b.total - a.total)
})()
