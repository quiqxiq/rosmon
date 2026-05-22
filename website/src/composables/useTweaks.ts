import { watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useTweaksStore } from '@/stores/tweaks'

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.substr(0, 2), 16)
  const g = parseInt(c.substr(2, 2), 16)
  const b = parseInt(c.substr(4, 2), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export function useTweaks() {
  const store = useTweaksStore()
  const { theme, density, cardStyle, sidebarMode, chartKind, palette } = storeToRefs(store)

  // Sync DOM attributes & CSS variables
  watchEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.setAttribute('data-theme', theme.value)
    root.setAttribute('data-density', density.value)
    root.setAttribute('data-cardstyle', cardStyle.value)
    root.setAttribute('data-sidebar-mode', sidebarMode.value)
    const [cyan, violet, lime] = palette.value
    root.style.setProperty('--accent-cyan', cyan)
    root.style.setProperty('--accent-violet', violet)
    root.style.setProperty('--accent-lime', lime)
    root.style.setProperty('--accent-cyan-soft', hexToRgba(cyan, 0.14))
    root.style.setProperty('--accent-violet-soft', hexToRgba(violet, 0.14))
    root.style.setProperty('--accent-lime-soft', hexToRgba(lime, 0.18))
  })

  return {
    theme,
    density,
    cardStyle,
    sidebarMode,
    chartKind,
    palette,
    setTheme: store.setTheme,
    setDensity: store.setDensity,
    setCardStyle: store.setCardStyle,
    setSidebarMode: store.setSidebarMode,
    setChartKind: store.setChartKind,
    setPalette: store.setPalette,
    toggleTheme: store.toggleTheme,
    cycleSidebar: store.cycleSidebar,
  }
}
