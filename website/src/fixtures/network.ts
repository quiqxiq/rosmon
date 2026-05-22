import { FIRST_NAMES, macRand, rand } from './_helpers'

export interface FixtureInterface {
  id: string
  name: string
  type: string
  running: boolean
  disabled: boolean
  comment: string
  macAddress: string
  mtu: number
  rxRate: number
  txRate: number
  rxBytes: number
  txBytes: number
  link: string
}

export const INTERFACES: FixtureInterface[] = [
  { id: '*1', name: 'ether1', type: 'ether', running: true, disabled: false, comment: 'WAN', macAddress: '74:4D:28:11:22:01', mtu: 1500, rxRate: 62_400_000, txRate: 24_100_000, rxBytes: 1.2e12, txBytes: 4.8e11, link: '1Gbps Full' },
  { id: '*2', name: 'ether2', type: 'ether', running: true, disabled: false, comment: 'LAN', macAddress: '74:4D:28:11:22:02', mtu: 1500, rxRate: 12_800_000, txRate: 38_400_000, rxBytes: 6.4e11, txBytes: 1.8e12, link: '1Gbps Full' },
  { id: '*3', name: 'ether3', type: 'ether', running: false, disabled: false, comment: '', macAddress: '74:4D:28:11:22:03', mtu: 1500, rxRate: 0, txRate: 0, rxBytes: 0, txBytes: 0, link: 'no-link' },
  { id: '*4', name: 'wlan1', type: 'wlan', running: true, disabled: false, comment: 'Hotspot-2G', macAddress: '74:4D:28:11:22:04', mtu: 1500, rxRate: 4_800_000, txRate: 18_200_000, rxBytes: 2.4e11, txBytes: 9.1e11, link: '2.4GHz n' },
  { id: '*5', name: 'wlan2', type: 'wlan', running: true, disabled: false, comment: 'Hotspot-5G', macAddress: '74:4D:28:11:22:05', mtu: 1500, rxRate: 21_400_000, txRate: 84_800_000, rxBytes: 1.1e12, txBytes: 4.2e12, link: '5GHz ac' },
  { id: '*6', name: 'bridge1', type: 'bridge', running: true, disabled: false, comment: 'br-hotspot', macAddress: '74:4D:28:11:22:00', mtu: 1500, rxRate: 28_200_000, txRate: 102_000_000, rxBytes: 1.3e12, txBytes: 5.1e12, link: '—' },
  { id: '*7', name: 'pppoe-out1', type: 'pppoe-out', running: true, disabled: false, comment: 'WAN PPPoE', macAddress: '00:00:00:00:00:00', mtu: 1480, rxRate: 0, txRate: 0, rxBytes: 0, txBytes: 0, link: 'connected' },
]

export interface FixtureIPPool {
  id: string
  name: string
  ranges: string
  next: string
  used: number
  total: number
}

export const IP_POOLS: FixtureIPPool[] = [
  { id: '*P1', name: 'pool-hotspot', ranges: '10.5.50.2-10.5.55.254', next: 'pool-hotspot', used: 187, total: 1276 },
  { id: '*P2', name: 'pool-pppoe-10m', ranges: '10.20.10.2-10.20.10.254', next: '', used: 32, total: 253 },
  { id: '*P3', name: 'pool-pppoe-20m', ranges: '10.20.20.2-10.20.20.254', next: '', used: 18, total: 253 },
  { id: '*P4', name: 'pool-pppoe-50m', ranges: '10.20.50.2-10.20.50.254', next: '', used: 9, total: 253 },
]

export interface FixtureARP {
  id: string
  address: string
  macAddress: string
  interface: string
  dynamic: boolean
  complete: boolean
  published: boolean
}

export const ARP: FixtureARP[] = (() => {
  const arr: FixtureARP[] = []
  for (let i = 0; i < 24; i++) {
    arr.push({
      id: `*A${i.toString(16).toUpperCase()}`,
      address: `10.5.${50 + Math.floor(i / 10)}.${(i % 10) + 2}`,
      macAddress: macRand(),
      interface: i % 3 === 0 ? 'wlan1' : i % 3 === 1 ? 'wlan2' : 'ether2',
      dynamic: i % 7 !== 0,
      complete: true,
      published: false,
    })
  }
  return arr
})()

export interface FixtureDHCPLease extends FixtureARP {
  hostName: string
  expiresAfter: number
  status: 'bound' | 'waiting'
}

export const DHCP_LEASES: FixtureDHCPLease[] = ARP.slice(0, 12).map((a, i) => ({
  ...a,
  hostName: `device-${['phone', 'laptop', 'desktop', 'tablet', 'iot'][i % 5]}-${100 + i}`,
  expiresAfter: Math.floor(rand(0, 86400 * 3)),
  status: i % 5 === 4 ? 'waiting' : 'bound',
}))

export interface FixtureQueue {
  id: string
  name: string
  target: string
  maxLimit: string
  maxLimitBps: number
  curRx: number
  curTx: number
  disabled: boolean
}

export const QUEUES: FixtureQueue[] = (() => {
  const arr: FixtureQueue[] = []
  for (let i = 0; i < 10; i++) {
    const cap = [5, 10, 20, 50][i % 4] * 1_000_000
    arr.push({
      id: `*Q${i.toString(16).toUpperCase()}`,
      name: `user-${FIRST_NAMES[i].toLowerCase()}${100 + i}`,
      target: `10.5.50.${i + 2}/32`,
      maxLimit: `${cap / 1_000_000}M/${cap / 2_000_000}M`,
      maxLimitBps: cap,
      curRx: Math.floor(rand(0, cap)),
      curTx: Math.floor(rand(0, cap * 0.4)),
      disabled: i % 9 === 0,
    })
  }
  return arr
})()
