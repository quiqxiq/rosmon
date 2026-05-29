import { useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import {
  Activity,
  BarChart2,
  HelpCircle,
  FileText,
  LayoutDashboard,
  Settings,
  Ticket,
  Wifi,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMobileNav, type MobileNavItemId } from '@/context/mobile-nav-store'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type NavItemConfig = {
  id: MobileNavItemId
  title: string
  icon: React.ElementType
  url?: string
  children?: { title: string; url: string }[]
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: LayoutDashboard,
    url: '/',
  },
  {
    id: 'hotspot',
    title: 'Hotspot',
    icon: Wifi,
    children: [
      { title: 'Users', url: '/hotspot/users' },
      { title: 'Profiles', url: '/hotspot/profiles' },
      { title: 'Active', url: '/hotspot/active' },
      { title: 'Hosts', url: '/hotspot/hosts' },
    ],
  },
  {
    id: 'voucher',
    title: 'Voucher',
    icon: Ticket,
    children: [
      { title: 'Generate', url: '/voucher/generate' },
      { title: 'Print Queue', url: '/voucher/print' },
      { title: 'Sales', url: '/voucher/sales' },
    ],
  },
  {
    id: 'traffic',
    title: 'Traffic',
    icon: Activity,
    url: '/traffic',
  },
  {
    id: 'log',
    title: 'Log',
    icon: FileText,
    url: '/log',
  },
  {
    id: 'report',
    title: 'Report',
    icon: BarChart2,
    children: [
      { title: 'Daily', url: '/report/daily' },
      { title: 'Monthly', url: '/report/monthly' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    icon: Settings,
    children: [
      { title: 'Profile', url: '/settings' },
      { title: 'Account', url: '/settings/account' },
      { title: 'Appearance', url: '/settings/appearance' },
      { title: 'Display', url: '/settings/display' },
      { title: 'Notifications', url: '/settings/notifications' },
    ],
  },
  {
    id: 'help-center',
    title: 'Help Center',
    icon: HelpCircle,
    url: '/help-center',
  },
]

function getItemById(id: MobileNavItemId): NavItemConfig | undefined {
  return NAV_ITEMS.find((i) => i.id === id)
}

function SubMenuSheet({
  item,
  open,
  onOpenChange,
  activePath,
}: {
  item: NavItemConfig
  open: boolean
  onOpenChange: (open: boolean) => void
  activePath: string
}) {
  if (!item.children) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side='bottom' className='rounded-t-2xl'>
        <SheetHeader>
          <SheetTitle>{item.title}</SheetTitle>
        </SheetHeader>
        <nav className='flex flex-col gap-1 px-4 pb-8'>
          {item.children.map((child) => (
            <Link
              key={child.url}
              to={child.url}
              onClick={() => onOpenChange(false)}
              className={cn(
                'flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                activePath === child.url
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {child.title}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}

export function MobileBottomNav() {
  const { items } = useMobileNav()
  const { pathname } = useLocation()
  const [sheetItem, setSheetItem] = useState<NavItemConfig | null>(null)

  const visibleItems = items
    .map((id) => getItemById(id))
    .filter(Boolean) as NavItemConfig[]

  function isItemActive(item: NavItemConfig): boolean {
    if (item.url) return pathname === item.url
    if (item.children) {
      return item.children.some((c) => pathname === c.url)
    }
    return false
  }

  function handleClick(item: NavItemConfig) {
    if (item.children) {
      setSheetItem(item)
    }
  }

  return (
    <>
      <nav className='mk-bottom-nav'>
        {visibleItems.map((item) => {
          const Icon = item.icon
          const active = isItemActive(item)
          const hasChildren = !!item.children

          const content = (
            <span
              className={cn(
                'mk-bottom-nav-item',
                active && 'mk-bottom-nav-active'
              )}
            >
              <Icon className='size-5' />
              <span className='mk-bottom-nav-label'>{item.title}</span>
              {active && <span className='mk-bottom-nav-dot' />}
            </span>
          )

          if (hasChildren) {
            return (
              <button
                key={item.id}
                type='button'
                className='mk-bottom-nav-btn'
                onClick={() => handleClick(item)}
              >
                {content}
              </button>
            )
          }

          return (
            <Link
              key={item.id}
              to={item.url!}
              className='mk-bottom-nav-btn'
            >
              {content}
            </Link>
          )
        })}
      </nav>

      {sheetItem && (
        <SubMenuSheet
          item={sheetItem}
          open={!!sheetItem}
          onOpenChange={(open) => {
            if (!open) setSheetItem(null)
          }}
          activePath={pathname}
        />
      )}
    </>
  )
}
