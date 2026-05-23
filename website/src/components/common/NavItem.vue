<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Icon from '@/components/ui/Icon.vue'
import type { NavItem as NavItemType } from '@/fixtures/devices'

defineProps<{
  item: NavItemType
  active: boolean
  compact: boolean
}>()
</script>

<template>
  <RouterLink
    :to="item.to"
    :title="compact ? item.label : ''"
    class="row-hover relative flex items-center rounded-lg transition-colors"
    :class="compact ? 'justify-center p-2.5' : 'gap-2.5 px-2.5 py-2'"
    :style="{
      background: active ? 'var(--bg-active)' : 'transparent',
      color: active ? 'var(--text)' : 'var(--text-2)',
      fontSize: '13.5px',
      fontWeight: active ? 500 : 400,
      textDecoration: 'none',
    }"
  >
    <span
      v-if="active && !compact"
      class="absolute rounded-full"
      style="left: -12px; top: 22%; bottom: 22%; width: 3px; background: var(--accent-cyan)"
    />
    <Icon
      :name="item.icon"
      :size="17"
      :style="{ color: active ? 'var(--accent-cyan)' : undefined }"
    />
    <template v-if="!compact">
      <span class="flex-1">{{ item.label }}</span>
      <span v-if="item.live" class="dot dot-live" />
      <span
        v-if="item.badge"
        class="rounded-full px-1.5 text-[10.5px]"
        style="color: var(--muted); background: var(--bg-2); border: 1px solid var(--border)"
      >
        {{ item.badge }}
      </span>
    </template>
  </RouterLink>
</template>
