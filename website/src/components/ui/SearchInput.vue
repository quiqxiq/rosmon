<script setup lang="ts">
import Icon from './Icon.vue'

withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    width?: string | number
    showHotkey?: boolean
  }>(),
  { placeholder: 'Cari...', showHotkey: true },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()
</script>

<template>
  <div
    class="relative max-w-full sm:max-w-[360px]"
    :style="{
      flex: width ? 'none' : '1 0 auto',
      width: typeof width === 'number' ? `${width}px` : width,
    }"
  >
    <span
      class="pointer-events-none absolute top-1/2 -translate-y-1/2"
      style="left: 11px; color: var(--muted)"
    >
      <Icon name="Search" :size="15" />
    </span>
    <input
      class="input"
      style="padding-left: 34px; padding-right: 56px"
      :placeholder="placeholder"
      :value="modelValue"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
    <span
      v-if="showHotkey"
      class="kbd pointer-events-none absolute top-1/2 -translate-y-1/2"
      style="right: 8px"
    >
      ⌘K
    </span>
  </div>
</template>
