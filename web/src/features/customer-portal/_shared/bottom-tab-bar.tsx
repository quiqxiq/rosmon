import { Link, useRouterState } from '@tanstack/react-router'
import { FileText, Home, User, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePortalInvoices } from '../invoices/api/queries'

const tabs = [
  { href: '/portal', label: 'Beranda', icon: Home, exact: true },
  { href: '/portal/invoices', label: 'Tagihan', icon: FileText, exact: false },
  { href: '/portal/subscriptions', label: 'Langganan', icon: Wifi, exact: false },
  { href: '/portal/profile', label: 'Akun', icon: User, exact: false },
]

export function BottomTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  // Count unpaid invoices for badge (uses cached data if invoices tab was visited)
  const { data: invoices = [] } = usePortalInvoices({ status: 'issued' })
  const overdueData = usePortalInvoices({ status: 'overdue' })
  const unpaidCount = invoices.length + (overdueData.data?.length ?? 0)

  return (
    <nav className='fixed bottom-0 left-1/2 w-full max-w-[480px] -translate-x-1/2 border-t bg-background pb-[env(safe-area-inset-bottom)]'>
      <div className='flex'>
        {tabs.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              to={href}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <div className='relative'>
                <Icon className='size-5' />
                {label === 'Tagihan' && unpaidCount > 0 && (
                  <span className='absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white'>
                    {unpaidCount > 9 ? '9+' : unpaidCount}
                  </span>
                )}
              </div>
              <span className='leading-none'>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
