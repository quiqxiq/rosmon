<script setup lang="ts" generic="T extends string | number">
type Option = T | { value: T; label: string }

const props = defineProps<{
  modelValue: T
  options: ReadonlyArray<Option>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: T): void
}>()

function normalize(o: Option): { value: T; label: string } {
  if (typeof o === 'string' || typeof o === 'number') return { value: o, label: String(o) }
  return o
}

function select(v: T) {
  if (v !== props.modelValue) emit('update:modelValue', v)
}
</script>

<template>
  <div class="seg">
    <button
      v-for="opt in options"
      :key="String(normalize(opt).value)"
      type="button"
      :class="{ on: normalize(opt).value === modelValue }"
      @click="select(normalize(opt).value)"
    >
      {{ normalize(opt).label }}
    </button>
  </div>
</template>
