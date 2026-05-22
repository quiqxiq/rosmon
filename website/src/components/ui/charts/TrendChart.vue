<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsCoreOption } from 'echarts/core'
import EChart from '../EChart.vue'
import { useEChartTheme } from '@/composables/useEChartTheme'
import { useTweaks } from '@/composables/useTweaks'

interface Series {
  name: string
  data: number[]
  color?: string
}

const props = withDefaults(
  defineProps<{
    series: Series[]
    xLabels: string[]
    kind?: 'area' | 'line' | 'bar'
    height?: number
    formatY?: (v: number) => string
  }>(),
  { height: 220 },
)

const theme = useEChartTheme()
const { chartKind } = useTweaks()

const effectiveKind = computed(() => props.kind ?? chartKind.value)

const option = computed<EChartsCoreOption>(() => {
  const t = theme.value
  return {
    color: t.color,
    grid: { left: 40, right: 12, top: 16, bottom: 28 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: t.tooltip.backgroundColor,
      borderColor: t.tooltip.borderColor,
      textStyle: t.tooltip.textStyle,
      axisPointer: { type: 'shadow' },
    },
    legend: {
      show: props.series.length > 1,
      textStyle: { color: t._tokens.muted, fontSize: 11 },
      top: 0,
      right: 0,
    },
    xAxis: {
      type: 'category',
      data: props.xLabels,
      axisLine: { lineStyle: { color: t._tokens.border } },
      axisLabel: { color: t._tokens.muted, fontSize: 10 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: t._tokens.muted,
        fontSize: 10,
        formatter: props.formatY,
      },
      splitLine: { lineStyle: { color: t._tokens.border, type: 'dashed' } },
    },
    series: props.series.map((s, i) => {
      const color = s.color ?? t.color[i % t.color.length]
      if (effectiveKind.value === 'bar') {
        return {
          name: s.name,
          type: 'bar' as const,
          data: s.data,
          itemStyle: { color, borderRadius: [3, 3, 0, 0] },
          barMaxWidth: 24,
        }
      }
      return {
        name: s.name,
        type: 'line' as const,
        data: s.data,
        smooth: false,
        symbol: 'circle',
        symbolSize: 4,
        showSymbol: true,
        lineStyle: { color, width: 2 },
        itemStyle: { color },
        areaStyle:
          effectiveKind.value === 'area'
            ? {
                color: {
                  type: 'linear' as const,
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: `${color}80` },
                    { offset: 1, color: `${color}00` },
                  ],
                },
              }
            : undefined,
      }
    }),
  }
})
</script>

<template>
  <EChart :option="option" :style="{ height: `${height}px` }" />
</template>
