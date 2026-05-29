// Single source of truth for all TanStack Query keys.
//
// Why centralize?
// - Prevents typos like `['hostspot-users']` vs `['hotspot-users']`.
// - Makes prefix-based invalidation reliable. After mutating a hotspot user,
//   call `qc.invalidateQueries({ queryKey: ['hotspot', 'users', routerId] })`
//   and EVERY filter combination is invalidated automatically.
// - One place to grep when refactoring.
//
// Pattern: `[domain, resource, ...identifiers, filters?]`. Filters always
// last so they participate in prefix matching.

type QKFilters = Record<string, unknown> | undefined

export const qk = {
  // ────────────────────────── auth ──────────────────────────
  currentUser: () => ['auth', 'me'] as const,

  // ────────────────────────── status ──────────────────────────
  // Hotspot user status probe (router + mac). Captive-portal use case.
  userStatus: (router: string, mac: string) =>
    ['status', router, mac] as const,

  // ────────────────────────── settings (admin, global singleton) ──────────────────────────
  settings: () => ['settings'] as const,
  settingsLogo: () => ['settings', 'logo'] as const,

  // ────────────────────────── users ──────────────────────────
  users: (filters?: QKFilters) => ['users', filters ?? {}] as const,
  user: (id: string) => ['users', id] as const,

  // ────────────────────────── routers ──────────────────────────
  routers: () => ['routers'] as const,
  router: (rid: number) => ['routers', rid] as const,

  // ────────────────────────── hotspot · users ──────────────────────────
  hotspotUsers: (rid: number, filters?: QKFilters) =>
    ['hotspot', 'users', rid, filters ?? {}] as const,
  hotspotUser: (rid: number, uid: string) =>
    ['hotspot', 'users', rid, uid] as const,
  hotspotUserCount: (rid: number, profile?: string) =>
    ['hotspot', 'users', 'count', rid, profile ?? null] as const,

  // ────────────────────────── hotspot · profiles ──────────────────────────
  hotspotProfiles: (rid: number) => ['hotspot', 'profiles', rid] as const,
  hotspotProfile: (rid: number, pid: string) =>
    ['hotspot', 'profiles', rid, pid] as const,

  // ────────────────────────── hotspot · sessions ──────────────────────────
  hotspotActive: (rid: number) => ['hotspot', 'active', rid] as const,
  hotspotInactive: (rid: number) => ['hotspot', 'inactive', rid] as const,
  hotspotInactiveCount: (rid: number) =>
    ['hotspot', 'inactive', 'count', rid] as const,

  // ────────────────────────── hotspot · misc ──────────────────────────
  hotspotHosts: (rid: number) => ['hotspot', 'hosts', rid] as const,
  hotspotServers: (rid: number) => ['hotspot', 'servers', rid] as const,
  hotspotCookies: (rid: number) => ['hotspot', 'cookies', rid] as const,
  hotspotBindings: (rid: number) => ['hotspot', 'bindings', rid] as const,

  // ────────────────────────── ppp ──────────────────────────
  pppSecrets: (rid: number) => ['ppp', 'secrets', rid] as const,
  pppActive: (rid: number) => ['ppp', 'active', rid] as const,
  pppInactive: (rid: number) => ['ppp', 'inactive', rid] as const,
  pppInactiveCount: (rid: number) =>
    ['ppp', 'inactive', 'count', rid] as const,
  pppProfiles: (rid: number) => ['ppp', 'profiles', rid] as const,

  // ────────────────────────── network ──────────────────────────
  networkInterfaces: (rid: number) =>
    ['network', 'interfaces', rid] as const,
  interfaceTraffic: (rid: number, iface: string) =>
    ['network', 'traffic', rid, iface] as const,
  networkPools: (rid: number) => ['network', 'pools', rid] as const,
  networkQueues: (rid: number) => ['network', 'queues', rid] as const,
  natRules: (rid: number) => ['network', 'nat', rid] as const,
  dhcpLeases: (rid: number) => ['network', 'dhcp', 'leases', rid] as const,

  // ────────────────────────── system ──────────────────────────
  systemResource: (rid: number) => ['system', 'resource', rid] as const,
  systemResourceHistory: (rid: number) =>
    ['system', 'resource', 'history', rid] as const,
  systemLog: (rid: number) => ['system', 'log', rid] as const,
  systemClock: (rid: number) => ['system', 'clock', rid] as const,
  systemIdentity: (rid: number) => ['system', 'identity', rid] as const,
  routerboard: (rid: number) => ['system', 'routerboard', rid] as const,
  expireMonitor: (rid: number) =>
    ['system', 'expire-monitor', rid] as const,
  schedulers: (rid: number) => ['system', 'schedulers', rid] as const,
  scripts: (rid: number) => ['system', 'scripts', rid] as const,
  systemDashboard: (rid: number) => ['system', 'dashboard', rid] as const,

  // ────────────────────────── admin users (real backend, admin-only) ──────────────────────────
  adminUsers: () => ['admin', 'users'] as const,
  adminUser: (id: number) => ['admin', 'users', id] as const,

  // ────────────────────────── vouchers ──────────────────────────
  voucherPrintData: (rid: number, gencode: string) =>
    ['voucher', 'print-data', rid, gencode] as const,
  voucherSession: (rid: number, gencode: string) =>
    ['voucher', 'session', rid, gencode] as const,
  // Sales listing — params object captured at the end so every combo
  // caches separately. Prefix invalidation (`['voucher','sales',rid]`)
  // still wipes every variant after a record/import mutation.
  salesList: (rid: number, params: QKFilters) =>
    ['voucher', 'sales', rid, params ?? {}] as const,

  // ────────────────────────── templates ──────────────────────────
  templates: (filters?: QKFilters) => ['templates', filters ?? {}] as const,
  template: (id: string) => ['templates', id] as const,

  // ────────────────────────── reports ──────────────────────────
  // Filters (profile/server/search) participate in the key so different
  // filter combinations cache separately, and prefix invalidation
  // (`['report','daily', rid]`) still wipes every filter combo.
  reportDaily: (rid: number, date: string, filters?: QKFilters) =>
    ['report', 'daily', rid, date, filters ?? {}] as const,
  reportMonthly: (rid: number, year: number, month: number) =>
    ['report', 'monthly', rid, year, month] as const,
  reportResume: (rid: number, year: number) =>
    ['report', 'resume', rid, year] as const,
  reportSummary: (rid: number) => ['report', 'summary', rid] as const,

  // ────────────────────────── quick-print ──────────────────────────
  quickPrintPackages: (rid: number) =>
    ['quick-print', 'packages', rid] as const,
  quickPrintPackage: (rid: number, name: string) =>
    ['quick-print', 'packages', rid, name] as const,

  // ────────────────────────── hotspot · DB profiles & profile-config ──────────────────────────
  hotspotProfilesDB: (rid: number, filters?: QKFilters) =>
    ['hotspot', 'profiles-db', rid, filters ?? {}] as const,
  hotspotProfileDB: (rid: number, id: number) =>
    ['hotspot', 'profiles-db', rid, id] as const,
  profileConfigs: (rid: number) => ['hotspot', 'profile-configs', rid] as const,
  profileConfig: (rid: number, name: string) =>
    ['hotspot', 'profile-configs', rid, name] as const,

  // ────────────────────────── ppp (extended) ──────────────────────────
  pppProfile: (rid: number, pid: string) => ['ppp', 'profiles', rid, pid] as const,
  pppProfilesDB: (rid: number) => ['ppp', 'profiles-db', rid] as const,
  pppProfileDB: (rid: number, id: number) => ['ppp', 'profiles-db', rid, id] as const,

  // ────────────────────────── network (extended) ──────────────────────────
  networkArp: (rid: number, mac?: string) =>
    ['network', 'arp', rid, mac ?? null] as const,
  poolByName: (rid: number, name: string) =>
    ['network', 'pools', rid, name] as const,

  // ────────────────────────── system (extended) ──────────────────────────
  systemLicense: (rid: number) => ['system', 'license', rid] as const,

  // ────────────────────────── customers (DB, not device-scoped) ──────────────────────────
  customers: (filters?: QKFilters) => ['customers', filters ?? {}] as const,
  customer: (id: number) => ['customers', id] as const,

  // ────────────────────────── subscriptions (DB, not device-scoped) ──────────────────────────
  subscriptions: (filters?: QKFilters) => ['subscriptions', filters ?? {}] as const,
  subscription: (id: number) => ['subscriptions', id] as const,

  // ────────────────────────── reports · selling ──────────────────────────
  reportSelling: (rid: number, filters?: QKFilters) =>
    ['report', 'selling', rid, filters ?? {}] as const,
  reportSellingToday: (rid: number) => ['report', 'selling', 'today', rid] as const,
  reportSellingSummary: (rid: number, filters?: QKFilters) =>
    ['report', 'selling', 'summary', rid, filters ?? {}] as const,
} as const
