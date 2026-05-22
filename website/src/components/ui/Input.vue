<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    modelValue: string | number
    type?: string
    placeholder?: string
    sm?: boolean
    disabled?: boolean
  }>(),
  { type: 'text', sm: false, disabled: false },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>()

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  emit('update:modelValue', props.type === 'number' ? Number(target.value) : target.value)
}
</script>

<template>
  <input
    :type="type"
    class="input"
    :class="{ 'input-sm': sm }"
    :value="modelValue"
    :placeholder="placeholder"
    :disabled="disabled"
    @input="onInput"
  />
</template>
