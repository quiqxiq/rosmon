<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'

const props = withDefaults(
  defineProps<{
    page: number
    totalPages: number
    total: number
    perPage: number
    label?: string
  }>(),
  { label: 'baris' },
)

const emit = defineEmits<{
  (e: 'change', page: number): void
}>()

const totalPages = computed(() => Math.max(1, props.totalPages))

const range = computed<(number | '…')[]>(() => {
  const tp = totalPages.value
  const p = props.page
  const r: (number | '…')[] = []
  if (tp <= 7) {
    for (let i = 1; i <= tp; i++) r.push(i)
    return r
  }
  r.push(1)
  if (p > 3) r.push('…')
  const start = Math.max(2, p - 1)
  const end = Math.min(tp - 1, p + 1)
  for (let i = start; i <= end; i++) r.push(i)
  if (p < tp - 2) r.push('…')
  r.push(tp)
  return r
})

const from = computed(() => (props.total === 0 ? 0 : (props.page - 1) * props.perPage + 1))
const to = computed(() => Math.min(props.page * props.perPage, props.total))

function go(p: number) {
  if (p >= 1 && p <= totalPages.value && p !== props.page) emit('change', p)
}
</script>

<template>
  <div
    class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs"
    style="border-top: 1px solid var(--border); color: var(--muted)"
  >
    <span>
      Menampilkan
      <b style="color: var(--text-2); font-weight: 500">{{ from }}–{{ to }}</b>
      dari
      <b style="color: var(--text-2); font-weight: 500">{{ total.toLocaleString('id-ID') }}</b>
      {{ label }}
    </span>
    <div class="flex items-center gap-1">
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-icon"
        :disabled="page <= 1"
        :style="{ opacity: page <= 1 ? 0.4 : 1 }"
        title="Sebelumnya"
        @click="go(page - 1)"
      >
        <Icon name="ChevronLeft" :size="14" />
      </button>
      <template v-for="(p, i) in range" :key="typeof p === 'number' ? p : `e${i}`">
        <span v-if="p === '…'" class="px-1" style="color: var(--muted-2)">…</span>
        <button
          v-else
          type="button"
          class="tabular"
          :style="{
            minWidth: '28px',
            height: '28px',
            padding: '0 8px',
            borderRadius: '7px',
            border: p === page ? '1px solid transparent' : '1px solid var(--border)',
            background: p === page ? 'var(--accent-cyan-soft)' : 'transparent',
            color: p === page ? 'var(--accent-cyan)' : 'var(--text-2)',
            fontSize: '12px',
            fontWeight: p === page ? 600 : 500,
            cursor: 'pointer',
            transition: 'background 120ms',
          }"
          @click="go(p as number)"
        >
          {{ p }}
        </button>
      </template>
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-icon"
        :disabled="page >= totalPages"
        :style="{ opacity: page >= totalPages ? 0.4 : 1 }"
        title="Berikutnya"
        @click="go(page + 1)"
      >
        <Icon name="Chevron" :size="14" />
      </button>
    </div>
  </div>
</template>
