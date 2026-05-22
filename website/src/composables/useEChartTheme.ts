import { computed } from 'vue'
import { useTweaks } from './useTweaks'

export function useEChartTheme() {
  const { theme, palette } = useTweaks()

  return computed(() => {
    const isDark = theme.value === 'dark'
    const text = isDark ? '#E6EDF7' : '#0B1220'
    const text2 = isDark ? '#B6C2D6' : '#364154'
    const muted = isDark ? '#7E8AA3' : '#64748B'
    const border = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.08)'
    const bg = isDark ? '#0E162A' : '#FFFFFF'

    return {
      color: palette.value,
      backgroundColor: 'transparent',
      textStyle: { color: text, fontFamily: "'Geist', system-ui, sans-serif" },
      tooltip: {
        backgroundColor: bg,
        borderColor: border,
        textStyle: { color: text },
      },
      grid: { left: 36, right: 12, top: 14, bottom: 22 },
      categoryAxis: {
        axisLine: { lineStyle: { color: border } },
        axisLabel: { color: muted, fontSize: 10 },
        splitLine: { show: false },
      },
      valueAxis: {
        axisLine: { show: false },
        axisLabel: { color: muted, fontSize: 10 },
        splitLine: { lineStyle: { color: border, type: 'dashed' } },
      },
      line: {
        smooth: false,
        symbol: 'circle',
        symbolSize: 4,
      },
      bar: {
        itemStyle: { borderRadius: [3, 3, 0, 0] },
      },
      _tokens: { text, text2, muted, border, bg, palette: palette.value },
    }
  })
}
