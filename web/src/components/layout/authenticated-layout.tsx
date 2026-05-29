import { Outlet } from '@tanstack/react-router'
import { getCookie } from '@/lib/cookies'
import { cn } from '@/lib/utils'
import { LayoutProvider } from '@/context/layout-provider'
import { MobileNavProvider } from '@/context/mobile-nav-store'
import { SearchProvider } from '@/context/search-provider'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { Header } from '@/components/layout/header'
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav'
import { SkipToMain } from '@/components/skip-to-main'
import { PingIndicator } from '@/components/ping-indicator'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

type AuthenticatedLayoutProps = {
  children?: React.ReactNode
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const defaultOpen = getCookie('sidebar_state') !== 'false'
  return (
    <SearchProvider>
      <LayoutProvider>
        <MobileNavProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <SkipToMain />
            <AppSidebar />
            <SidebarInset
              className={cn(
                '@container/content',
                'has-data-[layout=fixed]:h-svh',
                'peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]',
                'pb-16 md:pb-0'
              )}
            >
              <Header fixed>
                <Search className='me-auto' />
                <PingIndicator />
                <ThemeSwitch />
                <ProfileDropdown />
              </Header>
              {children ?? <Outlet />}
            </SidebarInset>
            <MobileBottomNav />
          </SidebarProvider>
        </MobileNavProvider>
      </LayoutProvider>
    </SearchProvider>
  )
}