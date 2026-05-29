import { useEffect } from 'react'
import { AlertCircle, ChevronsUpDown, Loader2, Server, Wifi } from 'lucide-react'
import { useRouters } from '@/features/routers/api/queries'
import type { RouterPublicView } from '@/features/routers/api/schema'
import { useActiveRouterStore } from '@/stores/active-router-store'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

// Status → dot color. Aligned with backend status enum so a quick glance
// at the switcher tells the user which router is reachable right now.
const statusDotClass: Record<RouterPublicView['status'], string> = {
  connected: 'bg-emerald-500',
  unknown: 'bg-zinc-400',
  disconnected: 'bg-amber-500',
  error: 'bg-red-500',
}

function statusLabel(r: RouterPublicView): string {
  // ip:port — Status. Backend's default api_port is 8728; show only when
  // it deviates so the common case stays compact.
  const addr = r.api_port && r.api_port !== 8728
    ? `${r.ip_address}:${r.api_port}`
    : r.ip_address
  const status = r.status.charAt(0).toUpperCase() + r.status.slice(1)
  return `${addr} — ${status}`
}

export function RouterSwitcher() {
  const { isMobile } = useSidebar()
  const { data: routers, isLoading, isError, refetch } = useRouters()
  const routerId = useActiveRouterStore((s) => s.routerId)
  const setRouterId = useActiveRouterStore((s) => s.setRouterId)

  // Auto-select the first router on first load. Only fires when the user
  // hasn't picked one yet, so refresh-and-restore stays sticky.
  useEffect(() => {
    if (routerId == null && routers && routers.length > 0) {
      setRouterId(routers[0].id)
    }
    // If the persisted routerId no longer exists in the list (deleted by
    // an admin, etc.), fall back to the first available one.
    if (
      routerId != null &&
      routers &&
      routers.length > 0 &&
      !routers.some((r) => r.id === routerId)
    ) {
      setRouterId(routers[0].id)
    }
  }, [routerId, routers, setRouterId])

  const active = routers?.find((r) => r.id === routerId) ?? null

  // ─────────────────── Render states ───────────────────

  if (isLoading) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size='lg' disabled>
            <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
              <Loader2 className='size-4 animate-spin' />
            </div>
            <div className='grid flex-1 text-start text-sm leading-tight'>
              <span className='truncate font-semibold'>Loading…</span>
              <span className='truncate text-xs text-muted-foreground'>
                Fetching routers
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (isError) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size='lg' onClick={() => refetch()}>
            <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive'>
              <AlertCircle className='size-4' />
            </div>
            <div className='grid flex-1 text-start text-sm leading-tight'>
              <span className='truncate font-semibold'>Failed to load</span>
              <span className='truncate text-xs text-muted-foreground'>
                Click to retry
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  if (!routers || routers.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size='lg' disabled>
            <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground'>
              <Server className='size-4' />
            </div>
            <div className='grid flex-1 text-start text-sm leading-tight'>
              <span className='truncate font-semibold'>No routers</span>
              <span className='truncate text-xs text-muted-foreground'>
                Contact your admin to add one
              </span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size='lg'
              className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
            >
              <div className='flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground'>
                <Wifi className='size-4' />
              </div>
              <div className='grid flex-1 text-start text-sm leading-tight'>
                <span className='truncate font-semibold'>
                  {active?.name ?? 'Select router'}
                </span>
                <span className='truncate text-xs text-muted-foreground'>
                  {active ? statusLabel(active) : 'No router selected'}
                </span>
              </div>
              <ChevronsUpDown className='ms-auto' />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
            align='start'
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className='text-xs text-muted-foreground'>
              Routers
            </DropdownMenuLabel>
            {routers.map((r, index) => (
              <DropdownMenuItem
                key={r.id}
                onClick={() => setRouterId(r.id)}
                className='gap-2 p-2'
              >
                <div className='flex size-6 items-center justify-center rounded-sm border'>
                  <Server className='size-4 shrink-0' />
                </div>
                <div className='flex flex-1 items-center gap-2'>
                  <span className='flex-1 truncate'>{r.name}</span>
                  <span
                    className={`size-2 rounded-full ${statusDotClass[r.status]}`}
                    aria-label={r.status}
                  />
                </div>
                {index < 9 && (
                  <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
