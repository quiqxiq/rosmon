import type { IconName } from '@/components/ui/icons'

export interface FixtureDevice {
  id: string
  name: string
  slug: string
  address: string
  status: 'online' | 'warn' | 'offline' | 'danger'
  uptime: string
  users: number
  active: number
  version: string
}

export const DEVICES: FixtureDevice[] = [
  {
    id: 'rb-main',
    name: 'Mikrotik HAP ac²',
    slug: 'rb-main',
    address: '192.168.88.1',
    status: 'online',
    uptime: '23d 14h',
    users: 412,
    active: 187,
    version: 'RouterOS 7.16.2',
  },
  {
    id: 'rb-cabang-2',
    name: 'Mikrotik RB951Ui',
    slug: 'rb-cabang-2',
    address: '192.168.10.1',
    status: 'online',
    uptime: '7d 02h',
    users: 128,
    active: 54,
    version: 'RouterOS 7.15.3',
  },
  {
    id: 'rb-warnet',
    name: 'Mikrotik hEX S',
    slug: 'rb-warnet',
    address: '10.10.0.1',
    status: 'warn',
    uptime: '1d 04h',
    users: 86,
    active: 19,
    version: 'RouterOS 7.14.1',
  },
  {
    id: 'rb-kost',
    name: 'Mikrotik RB750Gr3',
    slug: 'rb-kost',
    address: '192.168.5.1',
    status: 'offline',
    uptime: '—',
    users: 64,
    active: 0,
    version: 'RouterOS 7.13.0',
  },
]

export interface NavItem {
  id: string
  label: string
  icon: IconName
  to: string
  primary?: boolean
  badge?: string
  live?: boolean
}

export const NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: 'Home', to: '/overview', primary: true },
  { id: 'devices', label: 'Devices', icon: 'Server', to: '/devices', primary: true },
  {
    id: 'hotspot',
    label: 'Hotspot',
    icon: 'Users',
    to: '/hotspot',
    primary: true,
    badge: '64',
  },
  {
    id: 'voucher',
    label: 'Voucher Generator',
    icon: 'Ticket',
    to: '/hotspot/voucher',
    primary: true,
  },
  { id: 'ppp', label: 'PPP', icon: 'Link2', to: '/ppp', badge: '12' },
  { id: 'network', label: 'Network', icon: 'Network', to: '/network' },
  { id: 'reports', label: 'Laporan', icon: 'Report', to: '/reports' },
  { id: 'system', label: 'System', icon: 'Activity', to: '/system' },
  { id: 'settings', label: 'Settings', icon: 'Cog', to: '/settings' },
]
