<script setup lang="ts">
defineProps<{
  label?: string
  hint?: string
  required?: boolean
}>()
</script>

<template>
  <div>
    <div v-if="label || hint" class="mb-1.5 flex items-baseline justify-between">
      <label v-if="label" class="text-xs font-medium" style="color: var(--text-2)">
        {{ label }}<span v-if="required" style="color: var(--danger)">&nbsp;*</span>
      </label>
      <span v-if="hint" class="text-[10.5px]" style="color: var(--muted)">{{ hint }}</span>
    </div>
    <slot />
    <slot name="error" />
  </div>
</template>
