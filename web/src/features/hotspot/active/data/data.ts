import { faker } from '@faker-js/faker'
import { type HotspotActive, type LoginBy } from './schema'

faker.seed(200)

const servers = ['HS-01', 'HS-02', 'HS-03']
const loginByValues: LoginBy[] = [
  'http-chap',
  'http-pap',
  'mac',
  'cookie',
  'trial',
]

function randomMac(): string {
  return Array.from({ length: 6 }, () =>
    faker.number
      .int({ min: 0, max: 255 })
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  ).join(':')
}

function formatDuration(totalMinutes: number): string {
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(2)} GB`
}

export const hotspotActivesSeed: HotspotActive[] = Array.from(
  { length: 60 },
  (_, i) => {
    const uptimeMinutes = faker.number.int({ min: 1, max: 4320 })
    const validityMinutes = faker.number.int({ min: 60, max: 10_080 })
    const remaining = Math.max(0, validityMinutes - uptimeMinutes)
    return {
      id: `*${(i + 1).toString().padStart(4, '0')}`,
      user:
        faker.helpers.maybe(
          () => faker.internet.username().toLowerCase(),
          { probability: 0.7 }
        ) ?? `voucher${faker.string.numeric(4)}`,
      address: faker.internet.ipv4(),
      macAddress: randomMac(),
      server: faker.helpers.arrayElement(servers),
      uptime: formatDuration(uptimeMinutes),
      sessionTimeLeft: formatDuration(remaining),
      keepaliveTimeout: '2m',
      loginBy: faker.helpers.arrayElement(loginByValues),
      bytesIn: faker.number.int({ min: 1024, max: 5_368_709_120 }),
      bytesOut: faker.number.int({ min: 1024, max: 2_147_483_648 }),
      comment:
        faker.helpers.maybe(() => faker.lorem.words(2), { probability: 0.2 }) ??
        '',
    }
  }
)

export const serverOptions = servers.map((s) => ({ label: s, value: s }))
export const loginByOptions: Array<{ label: string; value: LoginBy }> = [
  { label: 'HTTP CHAP', value: 'http-chap' },
  { label: 'HTTP PAP', value: 'http-pap' },
  { label: 'MAC', value: 'mac' },
  { label: 'Cookie', value: 'cookie' },
  { label: 'Trial', value: 'trial' },
]
