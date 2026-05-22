<script setup lang="ts">
import { computed } from 'vue'
import { ICONS, type IconName } from './icons'

const props = withDefaults(
  defineProps<{
    name: IconName
    size?: number | string
    strokeWidth?: number
    fill?: string
  }>(),
  {
    size: 18,
    strokeWidth: 1.75,
    fill: 'none',
  },
)

const icon = computed(() => ICONS[props.name])
const viewBox = computed(() => icon.value?.viewBox ?? '0 0 24 24')
</script>

<template>
  <svg
    :width="size"
    :height="size"
    :viewBox="viewBox"
    :fill="fill"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="shrink-0"
    v-html="icon?.body"
  />
</template>
