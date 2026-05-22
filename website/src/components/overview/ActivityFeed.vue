<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import { fmtAgo } from '@/utils/fmt'
import { ACTIVITY, type FixtureActivity, type ActivityType } from '@/fixtures/activity'
import type { IconName } from '@/components/ui/icons'

defineProps<{
  limit?: number
}>()

const map: Record<ActivityType, { icon: IconName; color: string; bg: string }> = {
  login: { icon: 'ArrowUpRight', color: 'var(--accent-cyan)', bg: 'var(--accent-cyan-soft)' },
  sale: { icon: 'Ticket', color: 'var(--accent-lime)', bg: 'var(--accent-lime-soft)' },
  kick: { icon: 'Kick', color: 'var(--danger)', bg: 'rgba(244,63,94,0.12)' },
  expiry: { icon: 'Clock', color: 'var(--warning)', bg: 'rgba(245,158,11,0.12)' },
}

const items = computed<FixtureActivity[]>(() => ACTIVITY.slice(0, 6))

function cfg(a: FixtureActivity) {
  return map[a.type]
}
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <div
      v-for="(a, i) in items"
      :key="i"
      class="row-hover flex items-center gap-2.5 rounded-lg px-1.5 py-2"
    >
      <div
        class="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md"
        :style="{ background: cfg(a).bg, color: cfg(a).color }"
      >
        <Icon :name="cfg(a).icon" :size="13" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-[12.5px]">
          <span class="font-medium">{{ a.user }}</span>
          <span style="color: var(--muted)"> {{ a.detail }}</span>
        </div>
      </div>
      <span class="shrink-0 text-[11px]" style="color: var(--muted-2)">{{ fmtAgo(a.t) }}</span>
    </div>
  </div>
</template>
