<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import type { FixtureDevice } from '@/fixtures/devices'

const props = defineProps<{
  device: FixtureDevice
  active?: boolean
}>()

defineEmits<{
  (e: 'click'): void
}>()

const statusColor = computed(() => {
  const m: Record<string, string> = {
    online: 'var(--success)',
    warn: 'var(--warning)',
    offline: 'var(--muted-2)',
    danger: 'var(--danger)',
  }
  return m[props.device.status] || 'var(--muted-2)'
})
</script>

<template>
  <button
    type="button"
    class="row-hover relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px]"
    :style="{
      background: active ? 'var(--bg-active)' : 'transparent',
      color: active ? 'var(--text)' : 'var(--text-2)',
      cursor: 'pointer',
      border: 0,
    }"
    @click="$emit('click')"
  >
    <span
      v-if="active"
      class="absolute"
      style="
        left: -12px;
        top: 20%;
        bottom: 20%;
        width: 3px;
        background: var(--accent-cyan);
        border-radius: 2px;
      "
    />
    <span
      class="relative flex shrink-0 items-center justify-center"
      style="
        width: 28px;
        height: 28px;
        border-radius: 7px;
        background: var(--bg-2);
        border: 1px solid var(--border);
      "
      :style="{ background: active ? 'var(--bg-3)' : 'var(--bg-2)' }"
    >
      <Icon name="Server" :size="14" :style="{ color: active ? 'var(--accent-cyan)' : 'var(--muted)' }" />
      <span
        class="absolute rounded-full"
        :style="{
          bottom: '-2px',
          right: '-2px',
          width: '9px',
          height: '9px',
          background: statusColor,
          border: '2px solid var(--bg-1)',
          boxShadow: device.status === 'online' ? `0 0 6px ${statusColor}` : 'none',
        }"
      />
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-[13px] font-medium">{{ device.slug }}</span>
      <span class="mono block text-[10.5px]" style="color: var(--muted)">{{ device.address }}</span>
    </span>
    <span
      v-if="device.active > 0"
      class="tabular text-[10.5px]"
      style="color: var(--muted)"
    >
      {{ device.active }}
    </span>
  </button>
</template>
