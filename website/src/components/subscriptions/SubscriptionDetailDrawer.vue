<script setup lang="ts">
import Drawer from '@/components/ui/Drawer.vue'
import Icon from '@/components/ui/Icon.vue'
import Badge from '@/components/ui/Badge.vue'
import type { Subscription } from '@/types/subscription'
import { fmtDateTime } from '@/utils/fmt'

defineProps<{
  open: boolean
  subscription: Subscription | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'edit', s: Subscription): void
  (e: 'patch-status', s: Subscription): void
  (e: 'reconcile', s: Subscription): void
  (e: 'delete', s: Subscription): void
}>()

function statusTone(status: string): 'success' | 'warn' | 'danger' | 'neutral' {
  if (status === 'active') return 'success'
  if (status === 'isolir' || status === 'suspended') return 'warn'
  if (status === 'terminated') return 'danger'
  return 'neutral'
}
</script>

<template>
  <Drawer
    :open="open"
    :title="subscription ? subscription.mikrotik_username : 'Detail Langganan'"
    @close="emit('close')"
  >
    <div v-if="subscription" class="space-y-5">
      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Status
        </h3>
        <div class="flex items-center justify-between rounded-lg p-3" style="background: var(--bg-2)">
          <div>
            <Badge :tone="statusTone(subscription.status)">{{ subscription.status }}</Badge>
            <div v-if="subscription.activated_at" class="mt-1 text-[11px]" style="color: var(--muted)">
              Aktif sejak {{ fmtDateTime(subscription.activated_at) }}
            </div>
            <div v-if="subscription.terminated_at" class="mt-1 text-[11px]" style="color: var(--muted)">
              Terminate pada {{ fmtDateTime(subscription.terminated_at) }}
            </div>
          </div>
          <button
            class="btn btn-sm"
            type="button"
            @click="emit('patch-status', subscription)"
          >
            <Icon name="Edit3" :size="12" />
            Ubah
          </button>
        </div>
      </section>

      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Detail
        </h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span style="color: var(--muted)">Service type</span>
            <span class="mono font-medium">{{ subscription.service_type.toUpperCase() }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Username MikroTik</span>
            <span class="mono font-medium">{{ subscription.mikrotik_username }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Customer ID</span>
            <span class="mono">#{{ subscription.customer_id }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Device ID</span>
            <span class="mono">#{{ subscription.device_id }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Paket</span>
            <span class="mono">#{{ subscription.bandwidth_profile_id }}</span>
          </div>
          <div v-if="subscription.notes" class="pt-2" style="border-top: 1px solid var(--border)">
            <span style="color: var(--muted)">Catatan</span>
            <p class="mt-1 text-sm">{{ subscription.notes }}</p>
          </div>
          <div class="flex justify-between pt-2" style="border-top: 1px solid var(--border)">
            <span style="color: var(--muted)">Dibuat</span>
            <span class="text-xs">{{ fmtDateTime(subscription.created_at) }}</span>
          </div>
        </div>
      </section>

      <section class="space-y-2">
        <button
          class="btn w-full"
          type="button"
          @click="emit('reconcile', subscription)"
        >
          <Icon name="Refresh" :size="14" />
          Reconcile ke router
        </button>
        <p class="text-[11px]" style="color: var(--muted)">
          Re-push state DB ke MikroTik. Berguna kalau ada drift karena sync sebelumnya gagal.
        </p>
      </section>
    </div>

    <template #footer>
      <button
        v-if="subscription"
        class="btn btn-danger btn-sm"
        type="button"
        @click="emit('delete', subscription)"
      >
        <Icon name="Trash" :size="13" />
        Hapus
      </button>
      <div class="flex-1" />
      <button class="btn btn-sm" type="button" @click="emit('close')">Tutup</button>
      <button
        v-if="subscription"
        class="btn btn-primary btn-sm"
        type="button"
        @click="emit('edit', subscription)"
      >
        <Icon name="Edit3" :size="13" />
        Edit
      </button>
    </template>
  </Drawer>
</template>
