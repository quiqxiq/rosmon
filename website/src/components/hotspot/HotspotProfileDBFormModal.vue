<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Field from '@/components/ui/Field.vue'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'
import Toggle from '@/components/ui/Toggle.vue'
import Segmented from '@/components/ui/Segmented.vue'
import type {
  HotspotProfileDB,
  HotspotProfileDBCreateInput,
  HotspotProfileDBUpdateInput,
  HotspotProfileRole,
  ExpiryMode,
} from '@/types/hotspot-profile-db'

const EXPIRY_MODE_OPTIONS = [
  { value: '0', label: 'Tidak ada expiry' },
  { value: 'rem', label: 'Remaining time' },
  { value: 'ntf', label: 'Next time full' },
  { value: 'remc', label: 'Remaining + cookie' },
  { value: 'ntfc', label: 'Next time full + cookie' },
]

const props = defineProps<{
  open: boolean
  initial?: HotspotProfileDB | null
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: HotspotProfileDBCreateInput | HotspotProfileDBUpdateInput): void
}>()

interface FormState {
  name: string
  role: HotspotProfileRole
  rate_limit: string
  description: string
  active: boolean
  // Permanent
  price_monthly: string
  // Voucher
  expiry_mode: ExpiryMode
  validity: string
  price: string
  sell_price: string
  lock_mac: boolean
}

const DEFAULT: FormState = {
  name: '',
  role: 'voucher',
  rate_limit: '',
  description: '',
  active: true,
  price_monthly: '',
  expiry_mode: '0',
  validity: '',
  price: '',
  sell_price: '',
  lock_mac: false,
}

const form = ref<FormState>({ ...DEFAULT })
const isEdit = computed(() => Boolean(props.initial))

watch(
  () => [props.initial, props.open] as const,
  ([init, open]) => {
    if (!open) return
    if (init) {
      form.value = {
        name: init.name,
        role: init.role,
        rate_limit: init.rate_limit ?? '',
        description: init.description ?? '',
        active: init.active,
        price_monthly: init.price_monthly ? String(init.price_monthly) : '',
        expiry_mode: init.expiry_mode ?? '0',
        validity: init.validity ?? '',
        price: init.price ? String(init.price) : '',
        sell_price: init.sell_price ? String(init.sell_price) : '',
        lock_mac: init.lock_mac ?? false,
      }
    } else {
      form.value = { ...DEFAULT }
    }
  },
  { immediate: true },
)

function submit() {
  if (!isEdit.value && !form.value.name.trim()) return

  if (isEdit.value) {
    const payload: HotspotProfileDBUpdateInput = {}
    if (form.value.rate_limit.trim()) payload.rate_limit = form.value.rate_limit.trim()
    if (form.value.description.trim()) payload.description = form.value.description.trim()
    payload.active = form.value.active
    if (props.initial?.role === 'permanent') {
      const pm = Number(form.value.price_monthly)
      if (!isNaN(pm)) payload.price_monthly = pm
    } else {
      payload.expiry_mode = form.value.expiry_mode
      if (form.value.validity.trim()) payload.validity = form.value.validity.trim()
      const p = Number(form.value.price)
      const sp = Number(form.value.sell_price)
      if (!isNaN(p)) payload.price = p
      if (!isNaN(sp)) payload.sell_price = sp
      payload.lock_mac = form.value.lock_mac
    }
    emit('save', payload)
  } else {
    const payload: HotspotProfileDBCreateInput = {
      name: form.value.name.trim(),
      role: form.value.role,
    }
    if (form.value.rate_limit.trim()) payload.rate_limit = form.value.rate_limit.trim()
    if (form.value.description.trim()) payload.description = form.value.description.trim()
    payload.active = form.value.active
    if (form.value.role === 'permanent') {
      const pm = Number(form.value.price_monthly)
      if (!isNaN(pm) && pm > 0) payload.price_monthly = pm
    } else {
      payload.expiry_mode = form.value.expiry_mode
      if (form.value.validity.trim()) payload.validity = form.value.validity.trim()
      const p = Number(form.value.price)
      const sp = Number(form.value.sell_price)
      if (!isNaN(p) && p > 0) payload.price = p
      if (!isNaN(sp) && sp > 0) payload.sell_price = sp
      payload.lock_mac = form.value.lock_mac
    }
    emit('save', payload)
  }
}

const activeRole = computed(() => (isEdit.value ? props.initial?.role : form.value.role) ?? 'voucher')
</script>

<template>
  <Modal
    :open="open"
    :title="isEdit ? 'Edit Profil Hotspot' : 'Tambah Profil Hotspot'"
    @close="emit('close')"
  >
    <div class="space-y-4">
      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Identitas
        </h3>
        <div class="space-y-3">
          <Field label="Nama profil" required>
            <Input
              v-model="form.name"
              placeholder="1day"
              :disabled="isEdit"
            />
          </Field>
          <Field label="Role" required>
            <div :class="{ 'pointer-events-none opacity-60': isEdit }">
              <Segmented
                v-model="form.role"
                :options="[
                  { value: 'voucher', label: 'Voucher' },
                  { value: 'permanent', label: 'Permanent' },
                ]"
              />
            </div>
          </Field>
          <Field label="Rate Limit" hint="Format MikroTik, mis. 5M/5M">
            <Input v-model="form.rate_limit" placeholder="5M/5M" />
          </Field>
          <Field label="Deskripsi">
            <Input v-model="form.description" placeholder="Paket 1 hari" />
          </Field>
        </div>
      </section>

      <!-- Permanent fields -->
      <section v-if="activeRole === 'permanent'">
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Billing Bulanan
        </h3>
        <Field label="Harga / Bulan (Rp)">
          <Input v-model="form.price_monthly" placeholder="150000" type="number" min="0" />
        </Field>
      </section>

      <!-- Voucher fields -->
      <section v-else>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Konfigurasi Voucher
        </h3>
        <div class="space-y-3">
          <Field label="Expiry mode" required>
            <Select v-model="form.expiry_mode" :options="EXPIRY_MODE_OPTIONS" />
          </Field>
          <Field label="Validity" hint="Format RouterOS: 1d, 7d, 30d, 1mo">
            <Input v-model="form.validity" placeholder="1d" />
          </Field>
          <div class="grid grid-cols-2 gap-3">
            <Field label="Harga modal (Rp)">
              <Input v-model="form.price" placeholder="5000" type="number" min="0" />
            </Field>
            <Field label="Harga jual (Rp)">
              <Input v-model="form.sell_price" placeholder="7000" type="number" min="0" />
            </Field>
          </div>
          <div
            class="flex items-center justify-between rounded-lg p-3"
            style="background: var(--bg-2)"
          >
            <div>
              <div class="text-sm font-medium">Lock ke MAC</div>
              <div class="text-xs" style="color: var(--muted)">
                Lock voucher ke MAC address saat login pertama
              </div>
            </div>
            <Toggle v-model="form.lock_mac" />
          </div>
        </div>
      </section>

      <div
        class="flex items-center justify-between rounded-lg p-3"
        style="background: var(--bg-2)"
      >
        <div>
          <div class="text-sm font-medium">Aktif</div>
          <div class="text-xs" style="color: var(--muted)">
            Profil nonaktif tidak ditampilkan di form langganan
          </div>
        </div>
        <Toggle v-model="form.active" />
      </div>
    </div>

    <template #footer>
      <button class="btn btn-sm" type="button" @click="emit('close')">Batal</button>
      <button
        class="btn btn-primary btn-sm"
        type="button"
        :disabled="submitting || (!isEdit && !form.name.trim())"
        @click="submit"
      >
        {{ submitting ? 'Menyimpan…' : isEdit ? 'Simpan' : 'Tambah' }}
      </button>
    </template>
  </Modal>
</template>
