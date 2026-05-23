<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number
    hue?: number
  }>(),
  { size: 28 },
)

const initials = computed(() =>
  (props.name || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase(),
)

const hue = computed(
  () => props.hue ?? Array.from(props.name || '').reduce((a, c) => a + c.charCodeAt(0), 0) % 360,
)

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: '50%',
  background: `linear-gradient(135deg, hsl(${hue.value} 70% 55%), hsl(${(hue.value + 40) % 360} 70% 45%))`,
  color: 'white',
  fontSize: `${props.size * 0.38}px`,
  fontWeight: 600,
  letterSpacing: '-0.02em',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}))
</script>

<template>
  <div :style="style">{{ initials }}</div>
</template>
