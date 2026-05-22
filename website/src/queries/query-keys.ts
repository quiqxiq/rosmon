export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  devices: {
    all: ['devices'] as const,
    detail: (id: string) => ['devices', id] as const,
  },
  hotspot: {
    users: (deviceId: string) => ['hotspot', 'users', deviceId] as const,
    profiles: (deviceId: string) => ['hotspot', 'profiles', deviceId] as const,
    active: (deviceId: string) => ['hotspot', 'active', deviceId] as const,
    hosts: (deviceId: string) => ['hotspot', 'hosts', deviceId] as const,
    bindings: (deviceId: string) => ['hotspot', 'bindings', deviceId] as const,
  },
  ppp: {
    secrets: (deviceId: string) => ['ppp', 'secrets', deviceId] as const,
    profiles: (deviceId: string) => ['ppp', 'profiles', deviceId] as const,
    active: (deviceId: string) => ['ppp', 'active', deviceId] as const,
  },
  network: {
    interfaces: (deviceId: string) => ['network', 'interfaces', deviceId] as const,
    ipPools: (deviceId: string) => ['network', 'ip-pools', deviceId] as const,
    arp: (deviceId: string) => ['network', 'arp', deviceId] as const,
    dhcpLeases: (deviceId: string) => ['network', 'dhcp-leases', deviceId] as const,
    queues: (deviceId: string) => ['network', 'queues', deviceId] as const,
  },
  system: {
    identity: (deviceId: string) => ['system', 'identity', deviceId] as const,
    resource: (deviceId: string) => ['system', 'resource', deviceId] as const,
    routerboard: (deviceId: string) => ['system', 'routerboard', deviceId] as const,
    clock: (deviceId: string) => ['system', 'clock', deviceId] as const,
    scripts: (deviceId: string) => ['system', 'scripts', deviceId] as const,
    schedulers: (deviceId: string) => ['system', 'schedulers', deviceId] as const,
  },
  history: {
    query: (deviceId: string, key: string) => ['history', deviceId, key] as const,
  },
  reports: {
    sales: (deviceId: string, from?: string, to?: string) =>
      ['reports', 'sales', deviceId, from ?? '', to ?? ''] as const,
    summary: (deviceId: string, date?: string) =>
      ['reports', 'summary', deviceId, date ?? ''] as const,
  },
  profileConfig: {
    all: (deviceId: string) => ['profile-configs', deviceId] as const,
  },
}
