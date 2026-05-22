<script setup lang="ts">
import { computed } from 'vue'

type Variant = 'default' | 'primary' | 'violet' | 'ghost' | 'danger'
type Size = 'default' | 'sm' | 'xs' | 'icon'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    icon?: boolean
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'default',
    size: 'default',
    icon: false,
    loading: false,
    disabled: false,
    type: 'button',
  },
)

const classes = computed(() => {
  const cls = ['btn']
  if (props.variant === 'primary') cls.push('btn-primary')
  else if (props.variant === 'violet') cls.push('btn-violet')
  else if (props.variant === 'ghost') cls.push('btn-ghost')
  else if (props.variant === 'danger') cls.push('btn-danger')
  if (props.size === 'sm') cls.push('btn-sm')
  else if (props.size === 'xs') cls.push('btn-xs')
  if (props.size === 'icon' || props.icon) cls.push('btn-icon')
  return cls.join(' ')
})
</script>

<template>
  <button :class="classes" :type="type" :disabled="disabled || loading">
    <slot />
  </button>
</template>
