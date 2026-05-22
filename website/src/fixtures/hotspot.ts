import { FIRST_NAMES, macRand, vid, ipFromSeed, rand } from './_helpers'

export interface FixtureHotspotProfile {
  name: string
  price: number
  validity: string
  speed: string
  sold: number
  color: 'cyan' | 'violet' | 'lime'
}

export const HS_PROFILES: FixtureHotspotProfile[] = [
  { name: '1HR-3K', price: 3000, validity: '1h', speed: '5M/2M', sold: 412, color: 'cyan' },
  { name: '6HR-5K', price: 5000, validity: '6h', speed: '5M/2M', sold: 318, color: 'cyan' },
  { name: '1HARI-10K', price: 10000, validity: '1d', speed: '10M/3M', sold: 506, color: 'violet' },
  { name: '7HARI-50K', price: 50000, validity: '7d', speed: '10M/5M', sold: 122, color: 'violet' },
  { name: '30HARI-150K', price: 150000, validity: '30d', speed: '15M/8M', sold: 47, color: 'lime' },
]

export interface FixtureHotspotUser {
  id: string
  name: string
  profile: string
  server: string
  uptime: number
  bytesIn: number
  bytesOut: number
  mac: string | null
  expiry: number
  comment: string
  disabled: boolean
  isActive: boolean
}

export const HS_USERS: FixtureHotspotUser[] = (() => {
  const arr: FixtureHotspotUser[] = []
  for (let i = 0; i < 64; i++) {
    const p = HS_PROFILES[i % HS_PROFILES.length]
    const active = i % 5 < 3
    const name =
      i % 11 === 0
        ? `voucher-${vid().toLowerCase()}`
        : `${FIRST_NAMES[i % FIRST_NAMES.length].toLowerCase()}${100 + i}`
    arr.push({
      id: `*${(0x10 + i).toString(16).toUpperCase()}`,
      name,
      profile: p.name,
      server: i % 4 === 0 ? 'hotspot1' : 'hotspot2',
      uptime: Math.floor(rand(0, 86400 * 3)),
      bytesIn: Math.floor(rand(0, 6e9)),
      bytesOut: Math.floor(rand(0, 1.5e9)),
      mac: i % 3 === 0 ? macRand() : null,
      expiry: Date.now() + (rand(0, 1) * 6 - 2) * 86400000,
      comment: i % 7 === 0 ? `vc-${new Date().toISOString().slice(0, 10)}` : '',
      disabled: !active && i % 3 === 0,
      isActive: active,
    })
  }
  return arr
})()

export interface FixtureHotspotActive {
  id: string
  user: string
  profile: string
  server: string
  address: string
  mac: string
  loginBy: string
  uptimeStart: number
  bytesIn: number
  bytesOut: number
  rxRate: number
  txRate: number
  sparkIn: number[]
}

export const HS_ACTIVE: FixtureHotspotActive[] = (() => {
  const arr: FixtureHotspotActive[] = []
  for (let i = 0; i < 12; i++) {
    const u = HS_USERS[i]
    arr.push({
      id: `*A${i.toString(16).toUpperCase()}`,
      user: u.name,
      profile: u.profile,
      server: u.server,
      address: ipFromSeed(i),
      mac: u.mac || macRand(),
      loginBy: 'cookie',
      uptimeStart: Date.now() - rand(0.1, 4.1) * 3600 * 1000,
      bytesIn: Math.floor(rand(0, 2e9)),
      bytesOut: Math.floor(rand(0, 6e8)),
      rxRate: 200_000 + Math.floor(rand(0, 5_000_000)),
      txRate: 50_000 + Math.floor(rand(0, 1_500_000)),
      sparkIn: Array.from({ length: 18 }, () => rand(0, 1)),
    })
  }
  return arr
})()
