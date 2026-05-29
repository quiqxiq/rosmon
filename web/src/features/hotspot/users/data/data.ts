import { faker } from '@faker-js/faker'
import { type HotspotUser } from './schema'

faker.seed(42)

const profiles = ['1M/1M', '2M/2M', '5M/5M', '10M/10M', '20M/20M', 'Unlimited']
const servers = ['all', 'HS-01', 'HS-02', 'HS-03']
const statuses: Array<'online' | 'expired' | 'idle' | 'offline'> = [
  'online',
  'expired',
  'idle',
  'offline',
]

function randomMac(): string {
  return Array.from({ length: 6 }, () =>
    faker.number.int({ min: 0, max: 255 }).toString(16).padStart(2, '0').toUpperCase()
  ).join(':')
}

function formatUptime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h >= 24) {
    const d = Math.floor(h / 24)
    const rh = h % 24
    return `${d}d ${rh}h ${m}m`
  }
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(2)} GB`
}

export { formatBytes }

export const hotspotUsersSeed: HotspotUser[] = Array.from({ length: 250 }, () => {
  const status = faker.helpers.arrayElement(statuses)
  const profile = faker.helpers.arrayElement(profiles)
  const isOnline = status === 'online' || status === 'idle'
  const uptimeMinutes = isOnline ? faker.number.int({ min: 1, max: 43200 }) : 0

  return {
    id: faker.string.uuid(),
    username: faker.helpers
      .maybe(() => faker.internet.username().toLowerCase(), { probability: 0.6 })
      ?? `user${faker.string.numeric(4)}`,
    password: faker.helpers
      .maybe(() => faker.internet.password({ length: 6 }), { probability: 0.4 })
      ?? faker.string.alphanumeric({ length: 6, casing: 'lower' }),
    profile,
    macAddress: randomMac(),
    ipAddress: isOnline ? faker.internet.ipv4() : undefined,
    server: faker.helpers.arrayElement(servers),
    status,
    uptime: isOnline ? formatUptime(uptimeMinutes) : '—',
    bytesIn: isOnline ? faker.number.int({ min: 1024, max: 5368709120 }) : 0,
    bytesOut: isOnline ? faker.number.int({ min: 1024, max: 2147483648 }) : 0,
    comment: faker.helpers.maybe(() => faker.lorem.words(3), { probability: 0.2 }),
    createdAt: faker.date.past(),
    expiresAt: status === 'expired'
      ? faker.date.recent({ days: 7 })
      : faker.helpers.maybe(() => faker.date.future(), { probability: 0.7 }),
  }
})

export const profileOptions = profiles.map((p) => ({ label: p, value: p }))
export const serverOptions = servers.map((s) => ({ label: s, value: s }))

export const statusOptions = [
  { label: 'Online', value: 'online' },
  { label: 'Expired', value: 'expired' },
  { label: 'Idle', value: 'idle' },
  { label: 'Offline', value: 'offline' },
]
