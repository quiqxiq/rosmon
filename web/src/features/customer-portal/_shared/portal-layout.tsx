import { Outlet } from '@tanstack/react-router'
import { BottomTabBar } from './bottom-tab-bar'

export function PortalLayout() {
  return (
    // Phone-frame on desktop: content stays narrow & centered
    <div className='bg-muted/30 min-h-screen'>
      <div className='relative mx-auto flex min-h-screen max-w-[480px] flex-col bg-background md:border-x md:shadow-lg'>
        <main className='flex-1 pb-20'>
          <Outlet />
        </main>
        <BottomTabBar />
      </div>
    </div>
  )
}
