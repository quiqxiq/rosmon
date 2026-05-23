<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import type { IconName } from '@/components/ui/icons'

const props = defineProps<{
  icon: IconName
  title: string
  desc: string
  color: 'cyan' | 'violet' | 'lime'
}>()

const c = computed(
  () =>
    ({
      cyan: 'var(--accent-cyan)',
      violet: 'var(--accent-violet)',
      lime: 'var(--accent-lime)',
    })[props.color],
)
const bg = computed(
  () =>
    ({
      cyan: 'var(--accent-cyan-soft)',
      violet: 'var(--accent-violet-soft)',
      lime: 'var(--accent-lime-soft)',
    })[props.color],
)
</script>

<template>
  <button
    type="button"
    class="card flex w-full cursor-pointer items-center gap-3 text-left transition-transform hover:-translate-y-0.5"
  >
    <div
      class="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg"
      :style="{ background: bg, color: c }"
    >
      <Icon :name="icon" :size="18" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="text-[13.5px] font-medium">{{ title }}</div>
      <div class="mt-0.5 text-xs" style="color: var(--muted)">{{ desc }}</div>
    </div>
    <Icon name="Chevron" :size="14" :style="{ color: 'var(--muted)' }" />
  </button>
</template>
