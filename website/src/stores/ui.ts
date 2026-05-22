import { defineStore } from 'pinia'

type Theme = 'light' | 'dark'
type Density = 'comfortable' | 'compact'

interface UIState {
  sidebarCollapsed: boolean
  theme: Theme
  density: Density
}

export const useUIStore = defineStore('ui', {
  state: (): UIState => ({
    sidebarCollapsed: false,
    theme: 'light',
    density: 'comfortable',
  }),
  actions: {
    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed
    },
    setTheme(theme: Theme) {
      this.theme = theme
    },
    setDensity(density: Density) {
      this.density = density
    },
  },
  persist: true,
})
