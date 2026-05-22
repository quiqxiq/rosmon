<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import Badge from '@/components/ui/Badge.vue'
import { fmtRpShort } from '@/utils/fmt'
import type { FixtureHotspotProfile } from '@/fixtures/hotspot'

const props = defineProps<{
  profile: FixtureHotspotProfile
  maxSold: number
}>()

const tone = computed(
  () =>
    ({
      cyan: { color: 'var(--accent-cyan)', bg: 'var(--accent-cyan-soft)' },
      violet: { color: 'var(--accent-violet)', bg: 'var(--accent-violet-soft)' },
      lime: { color: 'var(--accent-lime)', bg: 'var(--accent-lime-soft)' },
    })[props.profile.color],
)

const pct = computed(() => (props.profile.sold / props.maxSold) * 100)
</script>

<template>
  <button
    type="button"
    class="card flex w-full flex-col items-stretch text-left transition-transform hover:-translate-y-0.5"
    :style="{ borderTop: `2px solid ${tone.color}` }"
  >
    <div class="mb-2 flex items-center justify-between">
      <div
        class="flex h-9 w-9 items-center justify-center rounded-lg"
        :style="{ background: tone.bg, color: tone.color }"
      >
        <Icon name="Ticket" :size="18" />
      </div>
      <Badge :tone="profile.color">{{ profile.validity }}</Badge>
    </div>
    <div class="text-lg font-bold">{{ profile.name }}</div>
    <div
      class="mt-1 text-xl font-bold tabular"
      :style="{ color: tone.color, letterSpacing: '-0.02em' }"
    >
      {{ fmtRpShort(profile.price) }}
    </div>
    <div class="mt-2 flex flex-wrap items-center gap-2 text-xs" style="color: var(--muted)">
      <span class="flex items-center gap-1">
        <Icon name="Activity" :size="12" />
        <span class="mono">{{ profile.speed }}</span>
      </span>
      <span>·</span>
      <span class="flex items-center gap-1">
        <Icon name="Clock" :size="12" />
        <span class="mono">{{ profile.validity }}</span>
      </span>
    </div>
    <div class="mt-3 flex items-center justify-between text-xs" style="color: var(--muted)">
      <span>Terjual bulan ini</span>
      <span class="mono font-semibold" style="color: var(--text-2)">{{ profile.sold }}×</span>
    </div>
    <div class="bar mt-1.5">
      <i
        :style="{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${tone.color}, ${tone.color}aa)`,
        }"
      />
    </div>
  </button>
</template>
