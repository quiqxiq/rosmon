<script setup lang="ts">
import Icon from './Icon.vue'
import Spark from './Spark.vue'
import LiveTag from './LiveTag.vue'
import type { IconName } from './icons'

withDefaults(
  defineProps<{
    label: string
    value: string | number
    delta?: string
    trend?: 'up' | 'down' | 'flat'
    icon?: IconName
    accent?: string
    spark?: number[]
    live?: boolean
    sub?: string
  }>(),
  {},
)
</script>

<template>
  <div class="card" :style="accent ? { borderTop: `2px solid ${accent}` } : {}">
    <div class="mb-3 flex items-start justify-between gap-3">
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-medium uppercase tracking-wider" style="color: var(--muted)">
            {{ label }}
          </span>
          <LiveTag v-if="live" />
        </div>
        <div class="text-2xl font-semibold tabular tracking-tight">{{ value }}</div>
        <div v-if="sub" class="text-xs" style="color: var(--muted-2)">{{ sub }}</div>
      </div>
      <div
        v-if="icon"
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        :style="{ background: accent ? `${accent}22` : 'var(--bg-2)', color: accent ?? 'var(--muted)' }"
      >
        <Icon :name="icon" :size="18" />
      </div>
    </div>
    <div v-if="delta || spark" class="flex items-end justify-between gap-2">
      <div
        v-if="delta"
        class="flex items-center gap-1 text-xs tabular"
        :style="{
          color:
            trend === 'up'
              ? 'var(--success)'
              : trend === 'down'
                ? 'var(--danger)'
                : 'var(--muted)',
        }"
      >
        <Icon v-if="trend === 'up'" name="Up" :size="12" />
        <Icon v-else-if="trend === 'down'" name="Down" :size="12" />
        {{ delta }}
      </div>
      <Spark
        v-if="spark"
        :data="spark"
        kind="area"
        :color="accent ?? 'var(--accent-cyan)'"
        :width="90"
        :height="26"
      />
    </div>
  </div>
</template>
