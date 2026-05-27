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
    license: (deviceId: string) => ['system', 'license', deviceId] as const,
    scripts: (deviceId: string) => ['system', 'scripts', deviceId] as const,
    schedulers: (deviceId: string) => ['system', 'schedulers', deviceId] as const,
  },
  history: {
    query: (deviceId: string, key: string) => ['history', deviceId, key] as const,
  },
  reports: {
    selling: (deviceId: string, month?: string) =>
      ['reports', 'selling', deviceId, month ?? ''] as const,
    today: (deviceId: string) => ['reports', 'selling', 'today', deviceId] as const,
    summary: (deviceId: string, month?: string) =>
      ['reports', 'summary', deviceId, month ?? ''] as const,
  },
  profileConfig: {
    all: (deviceId: string) => ['profile-configs', deviceId] as const,
    byName: (deviceId: string, name: string) =>
      ['profile-configs', deviceId, name] as const,
  },
  customers: {
    all: ['customers'] as const,
    list: (filter: { status?: string; area?: string; q?: string } = {}) =>
      ['customers', 'list', filter.status ?? '', filter.area ?? '', filter.q ?? ''] as const,
    detail: (id: number) => ['customers', 'detail', id] as const,
  },
  bandwidthProfiles: {
    all: (deviceId: string) => ['bandwidth-profiles', deviceId] as const,
    detail: (deviceId: string, id: number) =>
      ['bandwidth-profiles', deviceId, id] as const,
  },
  subscriptions: {
    all: ['subscriptions'] as const,
    list: (filter: {
      customer_id?: number
      device_id?: number
      status?: string
      service_type?: string
    } = {}) =>
      [
        'subscriptions',
        'list',
        filter.customer_id ?? 0,
        filter.device_id ?? 0,
        filter.status ?? '',
        filter.service_type ?? '',
      ] as const,
    detail: (id: number) => ['subscriptions', 'detail', id] as const,
  },
}
