<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import Spark from '@/components/ui/Spark.vue'
import LiveTag from '@/components/ui/LiveTag.vue'
import type { IconName } from '@/components/ui/icons'

const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    delta?: string
    trend?: 'up' | 'down' | 'flat'
    icon: IconName
    accent: 'cyan' | 'violet' | 'lime'
    spark?: number[]
    live?: boolean
  }>(),
  {},
)

const accentColor = computed(
  () =>
    ({
      cyan: 'var(--accent-cyan)',
      violet: 'var(--accent-violet)',
      lime: 'var(--accent-lime)',
    })[props.accent],
)

const accentBg = computed(
  () =>
    ({
      cyan: 'var(--accent-cyan-soft)',
      violet: 'var(--accent-violet-soft)',
      lime: 'var(--accent-lime-soft)',
    })[props.accent],
)

const trendColor = computed(
  () =>
    props.trend === 'up'
      ? 'var(--success)'
      : props.trend === 'down'
        ? 'var(--danger)'
        : 'var(--muted)',
)
</script>

<template>
  <div class="card relative overflow-hidden" :style="{ borderTop: `2px solid ${accentColor}` }">
    <div class="mb-3.5 flex items-center justify-between">
      <div
        class="flex h-8 w-8 items-center justify-center rounded-lg"
        :style="{ background: accentBg, color: accentColor }"
      >
        <Icon :name="icon" :size="16" />
      </div>
      <LiveTag v-if="live" />
    </div>
    <div class="text-xs font-medium" style="color: var(--muted)">{{ label }}</div>
    <div class="mt-1 flex items-baseline gap-2">
      <span
        class="tabular text-[26px] font-semibold"
        style="letter-spacing: -0.02em"
      >
        {{ value }}
      </span>
      <slot name="subValue" />
    </div>
    <div class="mt-2 flex items-center justify-between gap-2">
      <span class="flex items-center gap-0.5 text-[11.5px]" :style="{ color: trendColor }">
        <Icon v-if="trend === 'up'" name="Up" :size="11" :stroke-width="2.5" />
        <Icon v-else-if="trend === 'down'" name="Down" :size="11" :stroke-width="2.5" />
        {{ delta }}
      </span>
      <Spark v-if="spark" :data="spark" :color="accentColor" kind="area" :width="70" :height="22" />
    </div>
  </div>
</template>
