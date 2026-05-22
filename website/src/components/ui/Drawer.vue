<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import Icon from './Icon.vue'

const props = defineProps<{
  open: boolean
  title?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function close() {
  emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}

watch(
  () => props.open,
  (v) => {
    if (v) {
      document.addEventListener('keydown', onKey)
      document.body.style.overflow = 'hidden'
    } else {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open">
      <div class="overlay" @click="close" />
      <aside class="drawer" role="dialog" aria-modal="true">
        <header
          v-if="title || $slots.header"
          class="flex items-center justify-between px-5 py-4"
          style="border-bottom: 1px solid var(--border)"
        >
          <div class="flex-1">
            <slot name="header">
              <h2 class="text-base font-semibold">{{ title }}</h2>
            </slot>
          </div>
          <button class="btn btn-ghost btn-icon btn-sm" type="button" @click="close">
            <Icon name="X" :size="16" />
          </button>
        </header>
        <div class="flex-1 overflow-y-auto p-5">
          <slot />
        </div>
        <footer
          v-if="$slots.footer"
          class="flex flex-wrap justify-end gap-2 px-5 py-4"
          style="border-top: 1px solid var(--border)"
        >
          <slot name="footer" />
        </footer>
      </aside>
    </div>
  </Teleport>
</template>
