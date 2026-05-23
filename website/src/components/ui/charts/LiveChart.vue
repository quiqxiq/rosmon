<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsCoreOption } from 'echarts/core'
import EChart from '../EChart.vue'
import { useEChartTheme } from '@/composables/useEChartTheme'
import { toRgba } from '@/utils/color'

interface LiveSeries {
  name: string
  data: number[]
  color?: string
}

const props = withDefaults(
  defineProps<{
    series?: LiveSeries[]
    windowSize?: number
    height?: number
    formatY?: (v: number) => string
  }>(),
  { series: () => [], windowSize: 60, height: 200 },
)

const theme = useEChartTheme()

const labels = computed(() => {
  return Array.from({ length: props.windowSize }, (_, i) => {
    const sec = props.windowSize - i
    return i === props.windowSize - 1 ? 'now' : i % 10 === 0 ? `-${sec}s` : ''
  })
})

const option = computed<EChartsCoreOption>(() => {
  const t = theme.value
  return {
    color: t.color,
    animation: false,
    grid: { left: 44, right: 12, top: 12, bottom: 22 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: t.tooltip.backgroundColor,
      borderColor: t.tooltip.borderColor,
      textStyle: t.tooltip.textStyle,
    },
    legend: {
      show: props.series.length > 1,
      textStyle: { color: t._tokens.muted, fontSize: 11 },
      top: 0,
      right: 0,
    },
    xAxis: {
      type: 'category',
      data: labels.value,
      axisLine: { lineStyle: { color: t._tokens.border } },
      axisLabel: { color: t._tokens.muted, fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: t._tokens.muted, fontSize: 10, formatter: props.formatY },
      splitLine: { lineStyle: { color: t._tokens.border, type: 'dashed' } },
    },
    series: (props.series ?? []).map((s, i) => {
      const rawColor = s.color ?? t.color[i % t.color.length]
      const color = toRgba(rawColor, 1)
      return {
        name: s.name,
        type: 'line' as const,
        data: s.data ?? [],
        smooth: true,
        showSymbol: false,
        lineStyle: { color, width: 2 },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: toRgba(rawColor, 0.4) },
              { offset: 1, color: toRgba(rawColor, 0) },
            ],
          },
        },
      }
    }),
  }
})
</script>

<template>
  <EChart :option="option" :style="{ height: `${height}px` }" />
</template>
