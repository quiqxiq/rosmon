import { useMemo } from 'react'
import { useActiveRouterId } from '@/stores/active-router-store'
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

  return useMemo<SidebarData>(() => {
    return {
      ...sidebarData,
      navGroups: sidebarData.navGroups.map((group) => {
        if (group.title === 'Main') {
          return {
            ...group,
            items: group.items.map((item) => {
              if ('items' in item && item.title === 'Hotspot') {
                return {
                  ...item,
                  badge: activeSessions > 0 ? String(activeSessions) : undefined,
                }
              }
              return item
            }),
          }
        }
        return group
      }),
    }
  }, [activeSessions])
}
