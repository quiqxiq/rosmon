<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="mb-5 flex flex-wrap items-start justify-between gap-4">
    <div>
      <h1 class="ph-title">{{ title }}</h1>
      <div v-if="subtitle" class="ph-sub">{{ subtitle }}</div>
    </div>
    <div v-if="$slots.right" class="flex flex-wrap items-center gap-2">
      <slot name="right" />
    </div>
  </div>
</template>
