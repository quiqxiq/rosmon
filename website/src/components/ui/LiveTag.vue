<script setup lang="ts">
withDefaults(
  defineProps<{
    on?: boolean
    label?: string
  }>(),
  { on: true, label: 'LIVE' },
)
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
    :style="{
      background: on ? 'rgba(16,185,129,0.12)' : 'var(--bg-2)',
      color: on ? 'var(--success)' : 'var(--muted)',
      border: `1px solid ${on ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
      letterSpacing: '0.08em',
    }"
  >
    <span
      :class="on ? 'dot dot-live' : 'dot'"
      :style="{ background: on ? 'var(--success)' : 'var(--muted)' }"
    />
    {{ label }}
  </span>
</template>
