import { useMemo } from 'react'
import { useActiveRouterId } from '@/stores/active-router-store'
import { useAuthStore } from '@/stores/auth-store'
import { useCurrentUser } from '@/features/auth/api/queries'
import { useHotspotActive } from '@/features/hotspot/active/api/queries'
import { type SidebarData } from '../types'
import { sidebarData } from './sidebar-data'

// Sidebar badge for the Hotspot section. Now that "online users" is no
// longer a thing on the Users page, the badge tracks just live active
// sessions — the count the operator most often acts on. Returns
// undefined when no router is selected (no badge shown).
export function useSidebarData(): SidebarData {
  const routerId = useActiveRouterId()
  const activeQuery = useHotspotActive(routerId ?? 0)
  const activeSessions = activeQuery.data?.length ?? 0

  const storedUser = useAuthStore((s) => s.auth.user)
  const { data: currentUser } = useCurrentUser()
  const user = currentUser || storedUser

  return useMemo<SidebarData>(() => {
    const currentRole = user?.role ?? 'admin'
    const formattedUser = {
      name: user?.username ?? sidebarData.user.name,
      email: user?.role ? `Role: ${user.role}` : sidebarData.user.email,
      avatar: '/avatars/01.png',
      role: currentRole,
    }

    const navGroups = sidebarData.navGroups
      .map((group) => {
        const filteredItems = group.items
          .filter((item) => {
            // Hide /admin routes from non-admins
            if ('url' in item && item.url?.startsWith('/admin') && currentRole !== 'admin') {
              return false
            }
            // Hide /registrations from viewers
            if ('url' in item && item.url === '/registrations' && currentRole === 'viewer') {
              return false
            }
            return true
          })
          .map((item) => {
            if (group.title === 'Main' && 'items' in item && item.title === 'Hotspot') {
              return {
                ...item,
                badge: activeSessions > 0 ? String(activeSessions) : undefined,
              }
            }
            return item
          })

        return {
          ...group,
          items: filteredItems,
        }
      })
      .filter((group) => group.items.length > 0)

    return {
      ...sidebarData,
      user: formattedUser,
      navGroups,
    }
  }, [activeSessions, user])
}
