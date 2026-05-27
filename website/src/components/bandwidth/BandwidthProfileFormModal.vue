<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Field from '@/components/ui/Field.vue'
import Input from '@/components/ui/Input.vue'
import NumberInput from '@/components/ui/NumberInput.vue'
import Toggle from '@/components/ui/Toggle.vue'
import Segmented from '@/components/ui/Segmented.vue'
import type {
  BandwidthProfile,
  BandwidthProfileCreateInput,
} from '@/types/bandwidth-profile'
import type { ServiceType } from '@/types/subscription'

// FormState internal: semua field defined supaya v-model Input typed strict.
// Saat submit, field service-specific yang tidak relevan di-drop dari payload.
interface FormState {
  service_type: ServiceType
  name: string
  mikrotik_profile_name: string

  // Common
  rate_limit: string
  parent_queue: string

  // PPPoE-only
  local_address: string
  remote_address: string
  session_timeout: string
  idle_timeout: string

  // Hotspot-only
  address_pool: string
  shared_users: number

  // Business
  price_monthly: number
  description: string
  active: boolean
}

const props = defineProps<{
  open: boolean
  // Kalau initial null → mode create. Kalau ada → mode edit (service_type +
  // mikrotik_profile_name di-disable karena natural key).
  initial?: BandwidthProfile | null
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: BandwidthProfileCreateInput): void
}>()

const DEFAULT: FormState = {
  service_type: 'pppoe',
  name: '',
  mikrotik_profile_name: '',
  rate_limit: '',
  parent_queue: '',
  local_address: '',
  remote_address: '',
  session_timeout: '',
  idle_timeout: '',
  address_pool: '',
  shared_users: 1,
  price_monthly: 0,
  description: '',
  active: true,
}

const form = ref<FormState>({ ...DEFAULT })

watch(
  () => props.initial,
  (v) => {
    form.value = v
      ? {
          service_type: v.service_type,
          name: v.name,
          mikrotik_profile_name: v.mikrotik_profile_name,
          rate_limit: v.rate_limit,
          parent_queue: v.parent_queue,
          local_address: v.local_address,
          remote_address: v.remote_address,
          session_timeout: v.session_timeout,
          idle_timeout: v.idle_timeout,
          address_pool: v.address_pool,
          shared_users: v.shared_users || 1,
          price_monthly: v.price_monthly,
          description: v.description,
          active: v.active,
        }
      : { ...DEFAULT }
  },
  { immediate: true },
)

const isEdit = computed(() => Boolean(props.initial))
const isPPPoE = computed(() => form.value.service_type === 'pppoe')
const isHotspot = computed(() => form.value.service_type === 'hotspot')

// Saat user switch service_type di mode create, bersihkan field lawan
// supaya tidak terkirim ke backend.
watch(
  () => form.value.service_type,
  (newType, oldType) => {
    if (isEdit.value || newType === oldType) return
    if (newType === 'pppoe') {
      form.value.address_pool = ''
      // shared_users default tetap 1, sengaja tidak di-reset supaya
      // konsisten saat balik lagi ke hotspot
    } else {
      form.value.local_address = ''
      form.value.remote_address = ''
      form.value.session_timeout = ''
      form.value.idle_timeout = ''
    }
  },
)

function submit() {
  if (!form.value.name.trim() || !form.value.mikrotik_profile_name.trim()) return

  const payload: BandwidthProfileCreateInput = {
    service_type: form.value.service_type,
    name: form.value.name.trim(),
    mikrotik_profile_name: form.value.mikrotik_profile_name.trim(),
    price_monthly: form.value.price_monthly,
    active: form.value.active,
  }
  if (form.value.rate_limit.trim()) payload.rate_limit = form.value.rate_limit.trim()
  if (form.value.parent_queue.trim()) payload.parent_queue = form.value.parent_queue.trim()
  if (form.value.description.trim()) payload.description = form.value.description.trim()

  if (form.value.service_type === 'pppoe') {
    if (form.value.local_address.trim()) payload.local_address = form.value.local_address.trim()
    if (form.value.remote_address.trim()) payload.remote_address = form.value.remote_address.trim()
    if (form.value.session_timeout.trim())
      payload.session_timeout = form.value.session_timeout.trim()
    if (form.value.idle_timeout.trim()) payload.idle_timeout = form.value.idle_timeout.trim()
  } else {
    if (form.value.address_pool.trim()) payload.address_pool = form.value.address_pool.trim()
    payload.shared_users = form.value.shared_users
  }

  emit('save', payload)
}
</script>

<template>
  <Modal
    :open="open"
    :title="isEdit ? 'Edit Paket' : 'Tambah Paket Bandwidth'"
    @close="emit('close')"
  >
    <div class="space-y-4">
      <!-- Tipe Layanan -->
      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Tipe Layanan
        </h3>
        <div :class="{ 'pointer-events-none opacity-60': isEdit }">
          <Segmented
            v-model="form.service_type"
            :options="[
              { value: 'pppoe', label: 'PPPoE' },
              { value: 'hotspot', label: 'Hotspot' },
            ]"
          />
        </div>
        <p v-if="isEdit" class="mt-1 text-[11px]" style="color: var(--muted)">
          Service type tidak dapat diubah setelah dibuat.
        </p>
      </section>

      <!-- Identitas (common) -->
      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Identitas
        </h3>
        <div class="space-y-3">
          <Field label="Nama paket" required hint="Nama yang ditampilkan di UI">
            <Input v-model="form.name" placeholder="Paket Rumah 10M" />
          </Field>
          <Field
            label="MikroTik profile name"
            required
            :hint="
              isHotspot
                ? 'Disarankan beda dari profile voucher (mis. hotspot-bulanan-10M) untuk hindari konflik dengan expiry service voucher.'
                : 'Match dengan nama profile di router (mis. ppp-rumah-10M)'
            "
          >
            <Input
              v-model="form.mikrotik_profile_name"
              :placeholder="isPPPoE ? 'ppp-rumah-10M' : 'hotspot-bulanan-10M'"
              :disabled="isEdit"
            />
          </Field>
          <Field label="Deskripsi">
            <Input v-model="form.description" placeholder="Paket standar pelanggan rumahan" />
          </Field>
        </div>
      </section>

      <!-- Konfigurasi Router -->
      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Konfigurasi Router
        </h3>
        <div class="space-y-3">
          <!-- Common fields -->
          <Field label="Rate limit (RX/TX)" hint="Format MikroTik, mis. 10M/10M. Kosong = unlimited">
            <Input v-model="form.rate_limit" placeholder="10M/10M" />
          </Field>
          <Field label="Parent queue" hint="Reference queue tree (opsional)">
            <Input v-model="form.parent_queue" placeholder="" />
          </Field>

          <!-- PPPoE-only -->
          <template v-if="isPPPoE">
            <div
              class="rounded-lg p-3 text-[11px]"
              style="background: var(--bg-2); color: var(--muted)"
            >
              Field di bawah khusus PPPoE — di-pass ke <span class="mono">/ppp/profile</span>
            </div>
            <Field label="Local address" hint="IP gateway PPPoE server">
              <Input v-model="form.local_address" placeholder="10.10.0.1" />
            </Field>
            <Field label="Remote address" hint="Nama IP pool atau IP tunggal client">
              <Input v-model="form.remote_address" placeholder="pool-rumah" />
            </Field>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Session timeout" hint="RouterOS duration (mis. 12h)">
                <Input v-model="form.session_timeout" placeholder="" />
              </Field>
              <Field label="Idle timeout" hint="Disconnect kalau idle (mis. 10m)">
                <Input v-model="form.idle_timeout" placeholder="" />
              </Field>
            </div>
          </template>

          <!-- Hotspot-only -->
          <template v-if="isHotspot">
            <div
              class="rounded-lg p-3 text-[11px]"
              style="background: var(--bg-2); color: var(--muted)"
            >
              Field di bawah khusus Hotspot — di-pass ke
              <span class="mono">/ip/hotspot/user/profile</span>
            </div>
            <Field label="Address pool" hint="Nama IP pool untuk DHCP hotspot">
              <Input v-model="form.address_pool" placeholder="hs-pool" />
            </Field>
            <Field label="Shared users" hint="Concurrent session per user (default 1)">
              <NumberInput v-model="form.shared_users" :min="1" :step="1" />
            </Field>
          </template>
        </div>
      </section>

      <!-- Harga & Status -->
      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Harga & Status
        </h3>
        <div class="space-y-3">
          <Field label="Harga per bulan (Rp)">
            <NumberInput v-model="form.price_monthly" :min="0" :step="10000" />
          </Field>
          <div
            class="flex items-center justify-between rounded-lg p-3"
            style="background: var(--bg-2)"
          >
            <div>
              <div class="text-sm font-medium">Aktif</div>
              <div class="text-xs" style="color: var(--muted)">
                Paket bisa dipilih saat membuat langganan
              </div>
            </div>
            <Toggle v-model="form.active" />
          </div>
        </div>
      </section>
    </div>
    <template #footer>
      <button class="btn btn-sm" type="button" @click="emit('close')">Batal</button>
      <button
        class="btn btn-primary btn-sm"
        type="button"
        :disabled="
          submitting || !form.name.trim() || !form.mikrotik_profile_name.trim()
        "
        @click="submit"
      >
        {{ submitting ? 'Menyimpan…' : isEdit ? 'Simpan' : 'Tambah' }}
      </button>
    </template>
  </Modal>
</template>
