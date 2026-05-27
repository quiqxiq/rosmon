<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import Drawer from '@/components/ui/Drawer.vue'
import Badge from '@/components/ui/Badge.vue'
import Icon from '@/components/ui/Icon.vue'
import type { Customer } from '@/types/customer'
import { useSubscriptionsQuery } from '@/queries/subscriptions.queries'
import { fmtDateTime } from '@/utils/fmt'

const props = defineProps<{
  open: boolean
  customer: Customer | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'edit', c: Customer): void
  (e: 'add-subscription', c: Customer): void
}>()

const router = useRouter()

const customerIdRef = computed(() => props.customer?.id ?? null)

const { data: subs, isPending: loadingSubs } = useSubscriptionsQuery(
  computed(() => (customerIdRef.value ? { customer_id: customerIdRef.value } : {})),
)

function goToSubscription(id: number) {
  router.push({ name: 'subscriptions', query: { id: String(id) } })
  emit('close')
}
</script>

<template>
  <Drawer :open="open" :title="customer ? customer.full_name : 'Detail Pelanggan'" @close="emit('close')">
    <div v-if="customer" class="space-y-5">
      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Identitas
        </h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span style="color: var(--muted)">No. WhatsApp</span>
            <span class="mono font-medium">{{ customer.phone }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Status</span>
            <Badge :tone="customer.status === 'aktif' ? 'success' : 'neutral'">
              {{ customer.status }}
            </Badge>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Alamat</span>
            <span class="text-right">{{ customer.address || '—' }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Area</span>
            <span>{{ customer.area || '—' }}</span>
          </div>
          <div v-if="customer.notes" class="pt-2" style="border-top: 1px solid var(--border)">
            <span style="color: var(--muted)">Catatan</span>
            <p class="mt-1 text-sm">{{ customer.notes }}</p>
          </div>
          <div class="flex justify-between pt-2" style="border-top: 1px solid var(--border)">
            <span style="color: var(--muted)">Terdaftar sejak</span>
            <span class="text-xs">{{ fmtDateTime(customer.created_at) }}</span>
          </div>
        </div>
      </section>

      <section>
        <div class="mb-2 flex items-center justify-between">
          <h3
            class="text-[10px] font-semibold uppercase"
            style="color: var(--muted); letter-spacing: 0.08em"
          >
            Langganan
          </h3>
          <button
            class="btn btn-primary btn-xs"
            type="button"
            @click="emit('add-subscription', customer)"
          >
            <Icon name="Plus" :size="12" />
            Tambah
          </button>
        </div>
        <div v-if="loadingSubs" class="text-sm" style="color: var(--muted)">Memuat…</div>
        <div
          v-else-if="(subs ?? []).length === 0"
          class="rounded-lg p-4 text-center text-sm"
          style="background: var(--bg-2); color: var(--muted)"
        >
          Belum ada langganan
        </div>
        <div v-else class="space-y-2">
          <button
            v-for="s in subs ?? []"
            :key="s.id"
            type="button"
            class="w-full rounded-lg p-3 text-left transition hover:opacity-80"
            style="background: var(--bg-2)"
            @click="goToSubscription(s.id)"
          >
            <div class="flex items-center justify-between">
              <div>
                <div class="mono text-sm font-medium">{{ s.mikrotik_username }}</div>
                <div class="text-[11px]" style="color: var(--muted)">
                  {{ s.service_type.toUpperCase() }} · device #{{ s.device_id }}
                </div>
              </div>
              <Badge :tone="s.status === 'active' ? 'success' : 'neutral'">
                {{ s.status }}
              </Badge>
            </div>
          </button>
        </div>
      </section>
    </div>

    <template #footer>
      <button class="btn btn-sm" type="button" @click="emit('close')">Tutup</button>
      <button
        v-if="customer"
        class="btn btn-primary btn-sm"
        type="button"
        @click="emit('edit', customer)"
      >
        <Icon name="Edit3" :size="13" />
        Edit
      </button>
    </template>
  </Drawer>
</template>
