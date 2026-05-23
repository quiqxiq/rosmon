<script setup lang="ts">
import Ring from '@/components/ui/Ring.vue'

defineProps<{
  label: string
  value: number
  color: string
  detail: string
}>()
</script>

<template>
  <div class="flex flex-col items-center gap-2 rounded-lg p-2" style="background: var(--bg-2)">
    <Ring :value="value" :size="78" :stroke="7" :color="color" :label="`${value}%`" />
    <div class="text-center">
      <div class="text-xs font-semibold">{{ label }}</div>
      <div class="mono mt-0.5 text-[10.5px]" style="color: var(--muted)">{{ detail }}</div>
    </div>
  </div>
</template>
