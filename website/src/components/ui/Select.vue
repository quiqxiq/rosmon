<script setup lang="ts" generic="T extends string | number">
type Option = T | { value: T; label: string }

const props = defineProps<{
  modelValue: T
  options: ReadonlyArray<Option>
  sm?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: T): void
}>()

function normalize(o: Option): { value: T; label: string } {
  if (typeof o === 'string' || typeof o === 'number') return { value: o, label: String(o) }
  return o
}

function onChange(e: Event) {
  const v = (e.target as HTMLSelectElement).value
  const first = props.options.length > 0 ? normalize(props.options[0]).value : null
  if (typeof first === 'number') emit('update:modelValue', Number(v) as T)
  else emit('update:modelValue', v as T)
}
</script>

<template>
  <select
    class="input select"
    :class="{ 'input-sm': sm }"
    :value="modelValue"
    :disabled="disabled"
    @change="onChange"
  >
    <option v-for="opt in options" :key="String(normalize(opt).value)" :value="normalize(opt).value">
      {{ normalize(opt).label }}
    </option>
  </select>
</template>
