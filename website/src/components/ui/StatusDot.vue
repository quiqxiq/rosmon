<script setup lang="ts">
import { computed } from 'vue'

type Status = 'online' | 'offline' | 'warn' | 'danger'

const props = withDefaults(
  defineProps<{
    status?: Status
    label?: string
    showLabel?: boolean
  }>(),
  { status: 'online', showLabel: true },
)

const map: Record<Status, { color: string; label: string }> = {
  online: { color: 'var(--success)', label: 'Online' },
  offline: { color: 'var(--muted-2)', label: 'Offline' },
  warn: { color: 'var(--warning)', label: 'Warning' },
  danger: { color: 'var(--danger)', label: 'Down' },
}

const cfg = computed(() => map[props.status])
const finalLabel = computed(() => props.label ?? cfg.value.label)
const dotStyle = computed(() => ({
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: cfg.value.color,
  boxShadow: props.status === 'online' ? `0 0 8px ${cfg.value.color}` : 'none',
  display: 'inline-block',
  flexShrink: 0,
}))
</script>

<template>
  <span class="inline-flex items-center gap-1.5">
    <span :style="dotStyle" />
    <span v-if="showLabel" class="text-xs" style="color: var(--muted)">{{ finalLabel }}</span>
  </span>
</template>
