<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: boolean
    indeterminate?: boolean
    disabled?: boolean
  }>(),
  { indeterminate: false, disabled: false },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

function onChange(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).checked)
}

import { ref, watch } from 'vue'
const el = ref<HTMLInputElement | null>(null)
watch(
  () => props.indeterminate,
  (v) => {
    if (el.value) el.value.indeterminate = v
  },
  { immediate: true },
)
</script>

<template>
  <input
    ref="el"
    type="checkbox"
    class="checkbox"
    :checked="modelValue"
    :disabled="disabled"
    @change="onChange"
    @click.stop
  />
</template>
