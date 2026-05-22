import { rand } from './_helpers'

export interface FixturePPPSecret {
  id: string
  name: string
  password: string
  profile: string
  service: string
  address: string
  callerId: string
  comment: string
  lastLoggedOut: number
  isActive: boolean
  disabled: boolean
}

export const PPP_SECRETS: FixturePPPSecret[] = (() => {
  const arr: FixturePPPSecret[] = []
  const profs = ['10M-PPPoE', '20M-PPPoE', '50M-PPPoE', '100M-PPPoE', '5M-Limit']
  const tags = ['rt', 'warnet', 'kantor', 'rumah', 'kios']
  for (let i = 0; i < 18; i++) {
    const active = i % 3 !== 2
    arr.push({
      id: `*P${(0x10 + i).toString(16).toUpperCase()}`,
      name: `pppoe-${tags[i % 5]}-${(i + 10).toString().padStart(2, '0')}`,
      password: '••••••••',
      profile: profs[i % profs.length],
      service: 'pppoe',
      address: `10.20.${1 + Math.floor(i / 8)}.${(i % 8) + 2}`,
      callerId: i % 4 === 0 ? `AA:BB:CC:${(0x10 + i).toString(16).toUpperCase()}:00:01` : '',
      comment: i % 5 === 0 ? `Pelanggan #${1000 + i}` : '',
      lastLoggedOut: Date.now() - rand(0, 1) * 86400000 * 7,
      isActive: active,
      disabled: i % 11 === 0,
    })
  }
  return arr
})()

export interface FixturePPPProfile {
  id: string
  name: string
  rateLimit: string
  localAddress: string
  remoteAddress: string
  parentQueue: string
  sessions: number
  dnsServer: string
}

export const PPP_PROFILES: FixturePPPProfile[] = [
  { id: '*P1', name: '5M-Limit', rateLimit: '5M/2M', localAddress: '10.20.1.1', remoteAddress: 'pool-pppoe-5m', parentQueue: 'all-ppp', sessions: 24, dnsServer: '8.8.8.8,1.1.1.1' },
  { id: '*P2', name: '10M-PPPoE', rateLimit: '10M/3M', localAddress: '10.20.1.1', remoteAddress: 'pool-pppoe-10m', parentQueue: 'all-ppp', sessions: 32, dnsServer: '8.8.8.8,1.1.1.1' },
  { id: '*P3', name: '20M-PPPoE', rateLimit: '20M/5M', localAddress: '10.20.1.1', remoteAddress: 'pool-pppoe-20m', parentQueue: 'all-ppp', sessions: 18, dnsServer: '8.8.8.8,1.1.1.1' },
  { id: '*P4', name: '50M-PPPoE', rateLimit: '50M/10M', localAddress: '10.20.1.1', remoteAddress: 'pool-pppoe-50m', parentQueue: 'all-ppp', sessions: 9, dnsServer: '8.8.8.8,1.1.1.1' },
  { id: '*P5', name: '100M-PPPoE', rateLimit: '100M/20M', localAddress: '10.20.1.1', remoteAddress: 'pool-pppoe-100m', parentQueue: 'all-ppp', sessions: 3, dnsServer: '8.8.8.8,1.1.1.1' },
]

export interface FixturePPPActive extends FixturePPPSecret {
  uptimeStart: number
  rxRate: number
  txRate: number
  bytesIn: number
  bytesOut: number
  encoding: string
}

export const PPP_ACTIVE: FixturePPPActive[] = PPP_SECRETS.filter((s) => s.isActive)
  .slice(0, 8)
  .map((s, i) => ({
    ...s,
    uptimeStart: Date.now() - rand(0, 1) * 86400000 * 3,
    rxRate: 200_000 + Math.floor(rand(0, 50_000_000)),
    txRate: 80_000 + Math.floor(rand(0, 15_000_000)),
    bytesIn: Math.floor(rand(0, 8e9)),
    bytesOut: Math.floor(rand(0, 2e9)),
    callerId: s.callerId || `AA:BB:CC:${(0x20 + i).toString(16).toUpperCase()}:11:22`,
    encoding: 'mppe128',
  }))

export const PPP_INACTIVE: FixturePPPSecret[] = PPP_SECRETS.filter((s) => !s.isActive)
