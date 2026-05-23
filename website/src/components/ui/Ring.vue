<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    value: number
    max?: number
    size?: number
    stroke?: number
    color?: string
    label?: string
    subLabel?: string
  }>(),
  { max: 100, size: 80, stroke: 8, color: 'var(--accent-cyan)' },
)

const r = computed(() => (props.size - props.stroke) / 2)
const c = computed(() => 2 * Math.PI * r.value)
const offset = computed(() => c.value - (Math.min(props.value, props.max) / props.max) * c.value)
</script>

<template>
  <div class="relative inline-block" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        fill="none"
        stroke="var(--bg-3)"
        :stroke-width="stroke"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        fill="none"
        :stroke="color"
        :stroke-width="stroke"
        :stroke-dasharray="c"
        :stroke-dashoffset="offset"
        stroke-linecap="round"
        :transform="`rotate(-90 ${size / 2} ${size / 2})`"
        style="transition: stroke-dashoffset 600ms ease"
      />
    </svg>
    <div class="absolute inset-0 flex flex-col items-center justify-center">
      <div
        class="tabular font-semibold"
        :style="{ fontSize: `${size * 0.22}px`, letterSpacing: '-0.02em' }"
      >
        {{ label }}
      </div>
      <div v-if="subLabel" class="mt-px text-[10px]" style="color: var(--muted)">
        {{ subLabel }}
      </div>
    </div>
  </div>
</template>
