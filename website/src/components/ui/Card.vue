<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    accent?: string
    tight?: boolean
  }>(),
  { tight: false },
)

const style = computed(() => (props.accent ? { borderTop: `2px solid ${props.accent}` } : {}))
</script>

<template>
  <div class="card" :class="{ 'card-tight': tight }" :style="style">
    <slot />
  </div>
</template>
