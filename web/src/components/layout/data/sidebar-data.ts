import {
  Activity,
  BarChart2,
  Bell,
  Boxes,
  Cpu,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutDashboard,
  Monitor,
  Network,
  Palette,
  Server,
  Settings,
  Settings2,
  Ticket,
  UserCog,
  Users,
  Wifi,
  Wrench,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'admin',
    email: 'admin@mikhmon.local',
    avatar: '/avatars/shadcn.jpg',
  },
  navGroups: [
    {
      title: 'Main',
      items: [
        {
          title: 'Dashboard',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Hotspot',
          icon: Wifi,
          items: [
            { title: 'Users', url: '/hotspot/users' },
            { title: 'Profiles', url: '/hotspot/profiles' },
            { title: 'Billing', url: '/hotspot/billing' },
            { title: 'Active', url: '/hotspot/active' },
            { title: 'Hosts', url: '/hotspot/hosts' },
          ],
        },
        {
          title: 'PPP',
          icon: Network,
          items: [
            { title: 'Secrets', url: '/ppp/secrets' },
            { title: 'Profiles', url: '/ppp/profiles' },
            { title: 'Active', url: '/ppp/active' },
            { title: 'Billing', url: '/ppp/billing' },
          ],
        },
        {
          title: 'Voucher',
          icon: Ticket,
          items: [
            { title: 'Generate', url: '/voucher/generate' },
            { title: 'Print Queue', url: '/voucher/print' },
            { title: 'Sales', url: '/voucher/sales' },
          ],
        },
      ],
    },
    {
      title: 'Billing',
      items: [
        {
          title: 'Customers',
          url: '/customers',
          icon: Users,
        },
        {
          title: 'Subscriptions',
          url: '/subscriptions',
          icon: CreditCard,
        },
        {
          title: 'Reports',
          url: '/reports',
          icon: BarChart2,
        },
      ],
    },
    {
      title: 'Monitor',
      items: [
        {
          title: 'Traffic',
          url: '/traffic',
          icon: Activity,
        },
        {
          title: 'Network',
          url: '/network',
          icon: Boxes,
        },
        {
          title: 'System',
          url: '/system',
          icon: Cpu,
        },
        {
          title: 'Log',
          url: '/log',
          icon: FileText,
        },
      ],
    },
    {
      title: 'Admin',
      items: [
        {
          title: 'Users',
          url: '/admin/users',
          icon: UserCog,
        },
        {
          title: 'Settings',
          url: '/admin/settings',
          icon: Settings2,
        },
        {
          title: 'Routers',
          url: '/admin/routers',
          icon: Server,
        },
      ],
    },
    {
      title: 'Other',
      items: [
        {
          title: 'Settings',
          icon: Settings,
          items: [
            {
              title: 'Profile',
              url: '/settings',
              icon: UserCog,
            },
            {
              title: 'Account',
              url: '/settings/account',
              icon: Wrench,
            },
            {
              title: 'Appearance',
              url: '/settings/appearance',
              icon: Palette,
            },
            {
              title: 'Notifications',
              url: '/settings/notifications',
              icon: Bell,
            },
            {
              title: 'Display',
              url: '/settings/display',
              icon: Monitor,
            },
          ],
        },
        {
          title: 'Help Center',
          url: '/help-center',
          icon: HelpCircle,
        },
      ],
    },
  ],
}
