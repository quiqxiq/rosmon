<script setup lang="ts" generic="T extends string">
import Icon from './Icon.vue'
import type { IconName } from './icons'

interface Tab {
  id: T
  label: string
  icon?: IconName
  count?: number | string
  live?: boolean
}

defineProps<{
  modelValue: T
  tabs: ReadonlyArray<Tab>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: T): void
}>()
</script>

<template>
  <div
    class="flex gap-1 overflow-x-auto border-b"
    style="border-color: var(--border); scrollbar-width: none"
  >
    <button
      v-for="t in tabs"
      :key="t.id"
      type="button"
      class="relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-sm transition-colors"
      :style="{
        color: modelValue === t.id ? 'var(--text)' : 'var(--muted)',
        fontWeight: modelValue === t.id ? 600 : 500,
      }"
      @click="emit('update:modelValue', t.id)"
    >
      <Icon v-if="t.icon" :name="t.icon" :size="15" />
      <span>{{ t.label }}</span>
      <span
        v-if="t.count != null"
        class="rounded-full px-1.5 py-0.5 text-[10px] tabular"
        :style="{
          background: modelValue === t.id ? 'var(--accent-cyan-soft)' : 'var(--bg-2)',
          color: modelValue === t.id ? 'var(--accent-cyan)' : 'var(--muted)',
        }"
      >
        {{ t.count }}
      </span>
      <span v-if="t.live" class="dot dot-live" />
      <span
        v-if="modelValue === t.id"
        class="absolute right-0 -bottom-px left-0 h-0.5"
        style="background: var(--accent-cyan)"
      />
    </button>
  </div>
</template>
