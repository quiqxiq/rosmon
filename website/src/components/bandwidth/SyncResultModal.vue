<script setup lang="ts">
import { computed } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Badge from '@/components/ui/Badge.vue'
import type { BandwidthProfileSyncResponse } from '@/types/bandwidth-profile'

const props = defineProps<{
  open: boolean
  result: BandwidthProfileSyncResponse | null
}>()

defineEmits<{
  (e: 'close'): void
}>()

const total = computed(() => {
  const r = props.result
  if (!r) return 0
  return r.synced.length + r.created.length + r.orphan.length + (r.skipped?.length ?? 0)
})
</script>

<template>
  <Modal :open="open" title="Hasil sinkronisasi paket" @close="$emit('close')">
    <div v-if="result" class="space-y-4 text-sm">
      <p style="color: var(--muted)">
        Total {{ total }} paket diperiksa antara router dan database.
      </p>

      <section>
        <div class="mb-2 flex items-center gap-2">
          <Badge tone="success">{{ result.created.length }} baru</Badge>
          <span class="text-xs" style="color: var(--muted)">— ditambahkan dari router</span>
        </div>
        <ul
          v-if="result.created.length"
          class="ml-2 list-disc space-y-1 text-xs"
          style="color: var(--muted)"
        >
          <li v-for="k in result.created" :key="k" class="mono">{{ k }}</li>
        </ul>
      </section>

      <section>
        <div class="mb-2 flex items-center gap-2">
          <Badge tone="cyan">{{ result.synced.length }} sinkron</Badge>
          <span class="text-xs" style="color: var(--muted)">— sudah ada di DB</span>
        </div>
        <ul
          v-if="result.synced.length"
          class="ml-2 list-disc space-y-1 text-xs"
          style="color: var(--muted)"
        >
          <li v-for="k in result.synced" :key="k" class="mono">{{ k }}</li>
        </ul>
      </section>

      <section>
        <div class="mb-2 flex items-center gap-2">
          <Badge tone="warn">{{ result.orphan.length }} orphan</Badge>
          <span class="text-xs" style="color: var(--muted)">
            — ada di DB tapi tidak di router (hapus manual kalau perlu)
          </span>
        </div>
        <ul
          v-if="result.orphan.length"
          class="ml-2 list-disc space-y-1 text-xs"
          style="color: var(--muted)"
        >
          <li v-for="k in result.orphan" :key="k" class="mono">{{ k }}</li>
        </ul>
      </section>

      <section v-if="result.skipped?.length">
        <div class="mb-2 flex items-center gap-2">
          <Badge tone="neutral">{{ result.skipped.length }} dilewati</Badge>
          <span class="text-xs" style="color: var(--muted)">— dimiliki voucher, tidak diimpor</span>
        </div>
        <ul class="ml-2 list-disc space-y-1 text-xs" style="color: var(--muted)">
          <li v-for="k in result.skipped" :key="k" class="mono">{{ k }}</li>
        </ul>
      </section>
    </div>
    <template #footer>
      <button class="btn btn-primary btn-sm" type="button" @click="$emit('close')">Tutup</button>
    </template>
  </Modal>
</template>
