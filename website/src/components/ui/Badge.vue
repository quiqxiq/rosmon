<script setup lang="ts">
import { computed } from 'vue'

type Tone = 'neutral' | 'success' | 'cyan' | 'violet' | 'lime' | 'warn' | 'danger'

const props = withDefaults(
  defineProps<{
    tone?: Tone
    dot?: boolean
  }>(),
  { tone: 'neutral', dot: false },
)

const classes = computed(() => {
  if (props.tone === 'neutral') return 'badge'
  return `badge badge-${props.tone}`
})
</script>

<template>
  <span :class="classes">
    <span v-if="dot" class="inline-block h-1.5 w-1.5 rounded-full" style="background: currentColor" />
    <slot />
  </span>
</template>
