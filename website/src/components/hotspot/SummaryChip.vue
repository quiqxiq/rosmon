<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  label: string
  value: number | string
  accent: 'cyan' | 'violet' | 'lime' | 'warn' | 'danger'
}>()

const color = computed(
  () =>
    ({
      cyan: 'var(--accent-cyan)',
      violet: 'var(--accent-violet)',
      lime: 'var(--accent-lime)',
      warn: 'var(--warning)',
      danger: 'var(--danger)',
    })[props.accent],
)
</script>

<template>
  <div
    class="inline-flex items-baseline gap-2 rounded-full px-3.5 py-2"
    style="background: var(--bg-1); border: 1px solid var(--border)"
  >
    <span class="h-1.5 w-1.5 rounded-full" :style="{ background: color }" />
    <span class="text-xs" style="color: var(--muted)">{{ label }}</span>
    <span class="tabular text-sm font-semibold">{{ value }}</span>
  </div>
</template>
