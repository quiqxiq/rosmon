import {
  Activity,
  BarChart2,
  Banknote,
  Bell,
  Boxes,
  Building2,
  CheckSquare,
  ClipboardList,
  Cpu,
  CreditCard,
  Database,
  FileText,
  HelpCircle,
  LayoutDashboard,
  MessageCircle,
  MessageSquare,
  MessageSquareText,
  Network,
  Palette,
  Receipt,
  ScrollText,
  Send,
  Server,
  Settings,
  Ticket,
  UserCog,
  Users,
  Users2,
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
          url: '/dashboard',
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
            // { title: 'Hosts', url: '/hotspot/hosts' }, // belum dipakai secara aktif
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
            { title: 'Sales', url: '/voucher/sales' }, // belum dipakai
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
          icon: CreditCard,
          items: [
            { title: 'Management', url: '/subscriptions' },
            { title: 'Monitoring', url: '/subscriptions/monitoring' },
          ],
        },
        {
          title: 'Invoices',
          url: '/invoices',
          icon: FileText,
        },
        {
          title: 'Payments',
          url: '/payments',
          icon: Banknote,
        },
        {
          title: 'Registrations',
          url: '/registrations',
          icon: ClipboardList,
        },
        {
          title: 'Reports',
          url: '/reports',
          icon: BarChart2,
        },
      ],
    },
    {
      title: 'Communications',
      items: [
        {
          title: 'Message Templates',
          url: '/admin/message-templates',
          icon: MessageSquareText,
        },
        {
          title: 'Notifications',
          url: '/admin/notifications',
          icon: Bell,
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
          title: 'Routers',
          url: '/admin/routers',
          icon: Server,
        },
        {
          title: 'Audit Logs',
          url: '/admin/audit-logs',
          icon: ScrollText,
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
            // { title: 'Profile', url: '/settings', icon: UserCog },     // tidak ada API backend
            // { title: 'Akun', url: '/settings/account', icon: Wrench }, // tidak ada API backend
            { title: 'Tampilan', url: '/settings/appearance', icon: Palette }, // UI only
            // { title: 'Notifikasi UI', url: '/settings/notifications', icon: Bell }, // browser notifications, bukan sistem
            // { title: 'Display', url: '/settings/display', icon: Building2 }, // UI only
            {
              title: 'Umum',
              url: '/settings/general',
              icon: Building2,
            },
            {
              title: 'Billing',
              url: '/settings/billing',
              icon: Receipt,
            },
            {
              title: 'WhatsApp',
              url: '/settings/whatsapp',
              icon: MessageCircle,
            },
            {
              title: 'Telegram',
              url: '/settings/telegram',
              icon: Send,
            },
            {
              title: 'Payment Gateway',
              url: '/settings/payment-gateway',
              icon: CreditCard,
            },
            {
              title: 'Backup',
              url: '/settings/backup',
              icon: Database,
            },
          ],
        },
        // { title: 'Help Center', url: '/help-center', icon: HelpCircle }, // ComingSoon placeholder
      ],
    },
    // {
    //   title: 'Example',   // Boilerplate shadcn — data statis, tidak terhubung backend
    //   items: [
    //     { title: 'Tasks', url: '/tasks', icon: CheckSquare },
    //     { title: 'Users', url: '/pengguna', icon: Users2 },
    //   ],
    // },
  ],
}
