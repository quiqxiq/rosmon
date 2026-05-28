<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Field from '@/components/ui/Field.vue'
import Select from '@/components/ui/Select.vue'
import Badge from '@/components/ui/Badge.vue'
import type { Subscription, SubscriptionStatus } from '@/types/subscription'

const props = defineProps<{
  open: boolean
  subscription: Subscription | null
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', status: SubscriptionStatus): void
}>()

const target = ref<SubscriptionStatus>('active')

watch(
  () => [props.open, props.subscription] as const,
  ([open, sub]) => {
    if (open && sub) {
      // Default ke status berbeda dari saat ini supaya tidak no-op.
      const nonActive: SubscriptionStatus = sub.status === 'isolir' ? 'paused' : 'isolir'
      target.value = sub.status === 'active' ? nonActive : 'active'
    }
  },
  { immediate: true },
)

const effectLabel = computed(() => {
  const t = target.value
  if (t === 'active') return 'Profile direset ke normal, disabled=no. Jika sebelumnya terminated, secret/user dibuat ulang di router.'
  if (t === 'isolir') return 'Ganti ke PROFILE_ISOLIR (throttle + captive portal), disabled=no. Customer masih terhubung tapi dibatasi.'
  if (t === 'paused') return 'Ganti ke PROFILE_PAUSED (kecepatan sangat rendah), disabled=no. Untuk pelanggan yang cuti sementara.'
  if (t === 'suspended') return 'Secret/user di MikroTik di-disable keras (disabled=yes). Customer tidak bisa connect sama sekali.'
  if (t === 'terminated') return 'Secret/user di MikroTik DIHAPUS permanen. Record di DB tetap untuk audit.'
  return 'Status di-set ke pending_install — tidak ada perubahan di router.'
})

const effectTone = computed<'success' | 'warn' | 'danger' | 'neutral'>(() => {
  if (target.value === 'active') return 'success'
  if (target.value === 'paused') return 'neutral'
  if (target.value === 'isolir') return 'warn'
  if (target.value === 'suspended' || target.value === 'terminated') return 'danger'
  return 'neutral'
})
</script>

<template>
  <Modal :open="open" title="Ubah status langganan" @close="emit('close')">
    <div v-if="subscription" class="space-y-4">
      <div
        class="flex items-center justify-between rounded-lg p-3"
        style="background: var(--bg-2)"
      >
        <div>
          <div class="mono text-sm font-medium">{{ subscription.mikrotik_username }}</div>
          <div class="text-xs" style="color: var(--muted)">
            {{ subscription.service_type.toUpperCase() }} · device #{{ subscription.device_id }}
          </div>
        </div>
        <Badge>{{ subscription.status }}</Badge>
      </div>

      <Field label="Status baru" required>
        <Select
          v-model="target"
          :options="[
            { value: 'pending_install', label: 'Pending install' },
            { value: 'active', label: 'Active (pulihkan)' },
            { value: 'isolir', label: 'Isolir (throttle, captive portal)' },
            { value: 'paused', label: 'Paused (kecepatan sangat rendah)' },
            { value: 'suspended', label: 'Suspended (blokir keras)' },
            { value: 'terminated', label: 'Terminated (hapus dari router)' },
          ]"
        />
      </Field>

      <div
        class="rounded-lg p-3 text-xs"
        :style="`background: var(--bg-2); border-left: 3px solid var(--${effectTone === 'neutral' ? 'border' : effectTone === 'danger' ? 'danger' : effectTone === 'warn' ? 'warn' : 'accent-cyan'});`"
      >
        <div class="mb-1 font-semibold" style="color: var(--text)">Efek</div>
        <div style="color: var(--muted)">{{ effectLabel }}</div>
      </div>
    </div>

    <template #footer>
      <button class="btn btn-sm" type="button" @click="emit('close')">Batal</button>
      <button
        class="btn btn-primary btn-sm"
        type="button"
        :disabled="submitting || !subscription || target === subscription.status"
        @click="emit('confirm', target)"
      >
        {{ submitting ? 'Menyimpan…' : 'Ubah status' }}
      </button>
    </template>
  </Modal>
</template>
