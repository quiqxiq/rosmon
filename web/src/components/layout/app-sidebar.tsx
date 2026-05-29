import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
// import { AppTitle } from './app-title'
import { useSidebarData } from './data/use-sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import { RouterSwitcher } from './router-switcher'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const sidebarData = useSidebarData()
  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        <RouterSwitcher />

        {/* Replace switchers above with <AppTitle /> below for a plain app title */}
        {/* <AppTitle /> */}
      </SidebarHeader>
      <SidebarContent>
        {sidebarData.navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
