import { FIRST_NAMES, rand } from './_helpers'

export interface FixtureScript {
  id: string
  name: string
  owner: string
  policy: string
  lastStarted: number
  runCount: number
  source: string
}

export const SCRIPTS: FixtureScript[] = [
  { id: '*S1', name: 'on-login-hotspot', owner: 'admin', policy: 'read,write,test', lastStarted: Date.now() - 30000, runCount: 1284, source: '/log info "hotspot login"' },
  { id: '*S2', name: 'expire-voucher-batch', owner: 'admin', policy: 'read,write,policy', lastStarted: Date.now() - 3600000, runCount: 486, source: ':foreach u in=[/ip hotspot user find]' },
  { id: '*S3', name: 'backup-daily', owner: 'admin', policy: 'read,write,policy,ftp', lastStarted: Date.now() - 86400000, runCount: 98, source: '/system backup save name=daily' },
  { id: '*S4', name: 'reset-counter-monthly', owner: 'admin', policy: 'read,write', lastStarted: Date.now() - 2592000000, runCount: 12, source: ':foreach q in=[/queue simple find]' },
]

export interface FixtureScheduler {
  id: string
  name: string
  startDate: string
  startTime: string
  interval: string
  onEvent: string
  runCount: number
  nextRun: number
  disabled: boolean
}

export const SCHEDULERS: FixtureScheduler[] = [
  { id: '*K1', name: 'sch-expire', startDate: '2025-01-01', startTime: '00:05:00', interval: '5m', onEvent: 'expire-voucher-batch', runCount: 12480, nextRun: Date.now() + 240000, disabled: false },
  { id: '*K2', name: 'sch-backup', startDate: '2025-01-01', startTime: '02:00:00', interval: '1d', onEvent: 'backup-daily', runCount: 145, nextRun: Date.now() + 7200000, disabled: false },
  { id: '*K3', name: 'sch-monthly', startDate: '2025-01-01', startTime: '00:00:00', interval: '30d', onEvent: 'reset-counter-monthly', runCount: 12, nextRun: Date.now() + 1209600000, disabled: false },
  { id: '*K4', name: 'sch-noop', startDate: '2025-03-01', startTime: '03:00:00', interval: '1d', onEvent: 'cleanup-temp', runCount: 24, nextRun: 0, disabled: true },
]

export interface FixtureLog {
  id: number
  time: string
  topics: string
  message: string
}

export const LOGS: FixtureLog[] = (() => {
  const topics = [
    'hotspot,info', 'hotspot,account,info', 'system,info', 'system,warning',
    'interface,info', 'firewall,warning', 'dhcp,info', 'wireless,info',
  ]
  const samples = [
    'logged in', 'logged out: idle-timeout', 'login from cookie', 'login failed',
    'lease bound', 'lease ended', 'link up', 'link down',
    'CPU usage above 80%', 'config changed by admin', 'voucher batch generated',
  ]
  return Array.from({ length: 40 }, (_, i) => ({
    id: i,
    time: new Date(Date.now() - i * 60000 * rand(0, 10))
      .toISOString()
      .slice(11, 19),
    topics: topics[i % topics.length],
    message: `${samples[i % samples.length]}${i % 4 === 0 ? ` (user=${FIRST_NAMES[i % FIRST_NAMES.length].toLowerCase()}${100 + i})` : ''}`,
  }))
})()

export interface FixtureSystemResource {
  cpu: number
  ram: number
  disk: number
  voltage: number
  temperature: number
  powerW: number
  uptime: string
  version: string
  board: string
  arch: string
  serial: string
  firmwareType: string
  firmware: string
  ipMgmt: string
}

export const SYSTEM_RESOURCE: FixtureSystemResource = {
  cpu: 37,
  ram: 62,
  disk: 18,
  voltage: 24.1,
  temperature: 48,
  powerW: 4.2,
  uptime: '23d 14h 32m',
  version: 'RouterOS 7.16.2',
  board: 'RB962UiGS-5HacT2HnT',
  arch: 'arm',
  serial: 'A1B2-C3D4-E5F6',
  firmwareType: 'ar9344',
  firmware: '7.16',
  ipMgmt: '192.168.88.1',
}

export const SYSTEM_CLOCK = {
  time: '14:32:18',
  date: '21 Mei 2026',
  timezone: 'Asia/Jakarta (UTC+7)',
  ntp: 'sync',
}
