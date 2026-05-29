import { faker } from '@faker-js/faker'
import { type HotspotHost } from './schema'

faker.seed(300)

const servers = ['HS-01', 'HS-02', 'HS-03']

function randomMac(): string {
  return Array.from({ length: 6 }, () =>
    faker.number
      .int({ min: 0, max: 255 })
      .toString(16)
      .padStart(2, '0')
      .toUpperCase()
  ).join(':')
}

export const hotspotHostsSeed: HotspotHost[] = Array.from(
  { length: 80 },
  (_, i) => {
    const authorized = faker.datatype.boolean({ probability: 0.55 })
    const bypassed = !authorized && faker.datatype.boolean({ probability: 0.3 })
    const dhcp = faker.datatype.boolean({ probability: 0.7 })
    const dynamic = faker.datatype.boolean({ probability: 0.6 })
    return {
      id: `*${(i + 1).toString().padStart(4, '0')}`,
      macAddress: randomMac(),
      address: faker.internet.ipv4(),
      toAddress: faker.internet.ipv4(),
      server: faker.helpers.arrayElement(servers),
      authorized,
      bypassed,
      dhcp,
      dynamic,
      comment:
        faker.helpers.maybe(() => faker.lorem.words(2), { probability: 0.15 }) ??
        '',
    }
  }
)

export const serverOptions = servers.map((s) => ({ label: s, value: s }))

export function hostFlags(host: HotspotHost): Array<{
  label: string
  title: string
  className: string
}> {
  const flags: Array<{ label: string; title: string; className: string }> = []
  if (host.authorized) {
    flags.push({
      label: 'A',
      title: 'Authorized',
      className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
    })
  }
  if (host.bypassed) {
    flags.push({
      label: 'P',
      title: 'Bypassed',
      className: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
    })
  }
  if (host.dhcp) {
    flags.push({
      label: 'H',
      title: 'DHCP',
      className: 'bg-violet-500/10 text-violet-700 dark:text-violet-400',
    })
  }
  if (host.dynamic) {
    flags.push({
      label: 'D',
      title: 'Dynamic',
      className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
    })
  }
  return flags
}
