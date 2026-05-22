import { defineStore } from 'pinia'

export type Theme = 'dark' | 'light'
export type Density = 'compact' | 'regular' | 'comfy'
export type CardStyle = 'flat' | 'elevated' | 'bordered'
export type SidebarMode = 'expanded' | 'icon' | 'hidden'
export type ChartKind = 'area' | 'line' | 'bar'
export type Palette = [string, string, string] // [cyan, violet, lime]

export const PALETTE_PRESETS: Palette[] = [
  ['#22D3EE', '#8B5CF6', '#A3E635'],
  ['#3B82F6', '#06B6D4', '#10B981'],
  ['#F97316', '#FACC15', '#EF4444'],
  ['#1E40AF', '#0EA5E9', '#64748B'],
  ['#84CC16', '#14B8A6', '#E7E5E4'],
]

interface TweaksState {
  theme: Theme
  density: Density
  cardStyle: CardStyle
  sidebarMode: SidebarMode
  chartKind: ChartKind
  palette: Palette
}

export const useTweaksStore = defineStore('tweaks', {
  state: (): TweaksState => ({
    theme: 'dark',
    density: 'regular',
    cardStyle: 'elevated',
    sidebarMode: 'expanded',
    chartKind: 'area',
    palette: PALETTE_PRESETS[0],
  }),
  actions: {
    setTheme(v: Theme) {
      this.theme = v
    },
    setDensity(v: Density) {
      this.density = v
    },
    setCardStyle(v: CardStyle) {
      this.cardStyle = v
    },
    setSidebarMode(v: SidebarMode) {
      this.sidebarMode = v
    },
    setChartKind(v: ChartKind) {
      this.chartKind = v
    },
    setPalette(v: Palette) {
      this.palette = v
    },
    toggleTheme() {
      this.theme = this.theme === 'dark' ? 'light' : 'dark'
    },
    cycleSidebar() {
      const cycle: Record<SidebarMode, SidebarMode> = {
        expanded: 'icon',
        icon: 'hidden',
        hidden: 'expanded',
      }
      this.sidebarMode = cycle[this.sidebarMode]
    },
  },
  persist: {
    key: 'roslib-tweaks-v1',
    pick: ['theme', 'density', 'cardStyle', 'sidebarMode', 'chartKind', 'palette'],
  },
})
