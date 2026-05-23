<script setup lang="ts">
import { computed } from 'vue'
import type { EChartsCoreOption } from 'echarts/core'
import EChart from '../EChart.vue'
import { useEChartTheme } from '@/composables/useEChartTheme'
import { toRgba } from '@/utils/color'

const props = withDefaults(
  defineProps<{
    value: number
    max?: number
    label?: string
    color?: string
    size?: number
  }>(),
  { max: 100, size: 140 },
)

const theme = useEChartTheme()

const option = computed<EChartsCoreOption>(() => {
  const t = theme.value
  const color = toRgba(props.color ?? t.color[0], 1)
  return {
    series: [
      {
        type: 'gauge',
        startAngle: 220,
        endAngle: -40,
        min: 0,
        max: props.max,
        progress: { show: true, width: 8, itemStyle: { color } },
        axisLine: { lineStyle: { width: 8, color: [[1, t._tokens.border]] } },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: {
          offsetCenter: [0, '70%'],
          color: t._tokens.muted,
          fontSize: 11,
        },
        detail: {
          valueAnimation: true,
          formatter: '{value}%',
          offsetCenter: [0, 0],
          color: t._tokens.text,
          fontSize: 18,
          fontWeight: 600,
        },
        data: [{ value: props.value, name: props.label ?? '' }],
      },
    ],
  }
})
</script>

<template>
  <EChart :option="option" :style="{ height: `${size}px`, width: `${size}px` }" />
</template>
