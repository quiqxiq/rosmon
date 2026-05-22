<script setup lang="ts">
import { computed } from 'vue'

type Kind = 'line' | 'area' | 'bar'

const props = withDefaults(
  defineProps<{
    data: number[]
    width?: number
    height?: number
    color?: string
    kind?: Kind
  }>(),
  { width: 90, height: 26, color: 'var(--accent-cyan)', kind: 'line' },
)

const stats = computed(() => {
  if (!props.data.length) return null
  const min = Math.min(...props.data)
  const max = Math.max(...props.data)
  const range = max - min || 1
  return { min, max, range }
})

const points = computed(() => {
  if (!stats.value) return []
  const { min, range } = stats.value
  return props.data.map((v, i) => {
    const x = (i / Math.max(1, props.data.length - 1)) * props.width
    const y = props.height - ((v - min) / range) * (props.height - 2) - 1
    return [x, y] as [number, number]
  })
})

const linePath = computed(() =>
  points.value.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' '),
)

const areaPath = computed(() => `${linePath.value} L${props.width},${props.height} L0,${props.height} Z`)

const barWidth = computed(() => props.width / Math.max(1, props.data.length))
</script>

<template>
  <svg
    v-if="stats"
    class="spark"
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
  >
    <template v-if="kind === 'bar'">
      <rect
        v-for="(v, i) in data"
        :key="i"
        :x="i * barWidth + 1"
        :y="height - (((v - stats.min) / stats.range) * (height - 2) + 1)"
        :width="Math.max(0, barWidth - 2)"
        :height="((v - stats.min) / stats.range) * (height - 2) + 1"
        :rx="1"
        :fill="color"
        opacity="0.85"
      />
    </template>
    <template v-else>
      <path v-if="kind === 'area'" :d="areaPath" :fill="color" opacity="0.18" />
      <path
        :d="linePath"
        fill="none"
        :stroke="color"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>
  </svg>
</template>
