import { Outlet } from '@tanstack/react-router'
import {
  Building2,
  CreditCard,
  Database,
  MessageCircle,
  Receipt,
  Send,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Main } from '@/components/layout/main'
import { SidebarNav } from './components/sidebar-nav'

const sidebarNavItems = [
  // { title: 'Profile', href: '/settings', icon: <UserCog size={18} /> },         // tidak ada API backend
  // { title: 'Akun', href: '/settings/account', icon: <Wrench size={18} /> },     // tidak ada API backend
  // { title: 'Tampilan', href: '/settings/appearance', icon: <Palette size={18} /> }, // UI only
  // { title: 'Notifikasi', href: '/settings/notifications', icon: <Bell size={18} /> }, // browser notif, bukan sistem
  // { title: 'Display', href: '/settings/display', icon: <Monitor size={18} /> }, // UI only
  {
    title: 'Umum',
    href: '/settings/general',
    icon: <Building2 size={18} />,
  },
  {
    title: 'Billing',
    href: '/settings/billing',
    icon: <Receipt size={18} />,
  },
  {
    title: 'WhatsApp',
    href: '/settings/whatsapp',
    icon: <MessageCircle size={18} />,
  },
  {
    title: 'Telegram',
    href: '/settings/telegram',
    icon: <Send size={18} />,
  },
  {
    title: 'Payment Gateway',
    href: '/settings/payment-gateway',
    icon: <CreditCard size={18} />,
  },
  {
    title: 'Backup',
    href: '/settings/backup',
    icon: <Database size={18} />,
  },
]

export function Settings() {
  return (
    <>
      <Main fixed>
        <div className='space-y-0.5'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            Settings
          </h1>
          <p className='text-muted-foreground'>
            Kelola konfigurasi sistem.
          </p>
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='flex flex-1 flex-col space-y-2 overflow-hidden md:space-y-2 lg:flex-row lg:space-y-0 lg:space-x-12'>
          <aside className='top-0 lg:sticky lg:w-1/5'>
            <SidebarNav items={sidebarNavItems} />
          </aside>
          <div className='flex w-full overflow-y-hidden p-1'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}
