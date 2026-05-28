<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Field from '@/components/ui/Field.vue'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'
import Segmented from '@/components/ui/Segmented.vue'
import Icon from '@/components/ui/Icon.vue'
import type {
  ServiceType,
  Subscription,
  SubscriptionCreateInput,
} from '@/types/subscription'
import { useCustomersQuery } from '@/queries/customers.queries'
import { usePPPProfilesDBQuery } from '@/queries/ppp-profiles-db.queries'
import { useHotspotProfilesDBQuery } from '@/queries/hotspot-profiles-db.queries'
import { useActiveDevice } from '@/composables/useActiveDevice'

interface FormState {
  customer_id: number
  device_id: number
  ppp_profile_id: number
  hotspot_profile_id: number
  service_type: ServiceType
  mikrotik_username: string
  mikrotik_password: string
  notes: string
}

const props = defineProps<{
  open: boolean
  initial?: Subscription | null
  presetCustomerId?: number
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: SubscriptionCreateInput): void
}>()

const DEFAULT: FormState = {
  customer_id: 0,
  device_id: 0,
  ppp_profile_id: 0,
  hotspot_profile_id: 0,
  service_type: 'pppoe',
  mikrotik_username: '',
  mikrotik_password: '',
  notes: '',
}

const form = ref<FormState>({ ...DEFAULT })

const { data: customers } = useCustomersQuery()
const { activeDeviceId } = useActiveDevice()
const deviceIdStr = computed(() =>
  form.value.device_id ? String(form.value.device_id) : '',
)

const { data: pppProfiles } = usePPPProfilesDBQuery(deviceIdStr)
const { data: hotspotProfiles } = useHotspotProfilesDBQuery(deviceIdStr, () => ({
  role: 'permanent',
  only_active: true,
}))

const isEdit = computed(() => Boolean(props.initial))

watch(
  () => [props.initial, props.presetCustomerId, props.open] as const,
  ([init, preset, open]) => {
    if (!open) return
    if (init) {
      form.value = {
        customer_id: init.customer_id,
        device_id: init.device_id,
        ppp_profile_id: init.ppp_profile_id ?? 0,
        hotspot_profile_id: init.hotspot_profile_id ?? 0,
        service_type: init.service_type,
        mikrotik_username: init.mikrotik_username,
        mikrotik_password: '',
        notes: init.notes,
      }
    } else {
      form.value = { ...DEFAULT }
      if (preset && preset > 0) form.value.customer_id = preset
      const did = Number(activeDeviceId.value)
      if (!Number.isNaN(did) && did > 0) form.value.device_id = did
    }
  },
  { immediate: true },
)

// Reset profile selection saat device atau service_type berubah.
watch(
  () => [form.value.device_id, form.value.service_type] as const,
  (curr, prev) => {
    if (prev[0] === undefined && prev[1] === undefined) return
    if (isEdit.value) return
    if (curr[0] !== prev[0] || curr[1] !== prev[1]) {
      form.value.ppp_profile_id = 0
      form.value.hotspot_profile_id = 0
    }
  },
)

function generatePassword() {
  const charset = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 10; i++) {
    s += charset[Math.floor(Math.random() * charset.length)]
  }
  form.value.mikrotik_password = s
}

const customerOptions = computed(() => [
  { value: 0, label: '— pilih pelanggan —' },
  ...(customers.value ?? []).map((c) => ({
    value: c.id,
    label: `${c.full_name} · ${c.phone}`,
  })),
])

const pppProfileOptions = computed(() => [
  { value: 0, label: form.value.device_id ? '— pilih profil PPP —' : '— pilih device dulu —' },
  ...(pppProfiles.value ?? []).map((p) => ({
    value: p.id,
    label: `${p.name}${p.rate_limit ? ' · ' + p.rate_limit : ''}`,
  })),
])

const hotspotProfileOptions = computed(() => [
  { value: 0, label: form.value.device_id ? '— pilih profil Hotspot —' : '— pilih device dulu —' },
  ...(hotspotProfiles.value ?? []).map((p) => ({
    value: p.id,
    label: `${p.name}${p.rate_limit ? ' · ' + p.rate_limit : ''}`,
  })),
])

const selectedProfileId = computed(() =>
  form.value.service_type === 'pppoe'
    ? form.value.ppp_profile_id
    : form.value.hotspot_profile_id,
)

const canSubmit = computed(() => {
  if (isEdit.value) return true
  return (
    form.value.device_id > 0 &&
    form.value.customer_id > 0 &&
    selectedProfileId.value > 0 &&
    form.value.mikrotik_username.trim().length > 0 &&
    form.value.mikrotik_password.length > 0
  )
})

function submit() {
  if (!canSubmit.value) return
  const payload: SubscriptionCreateInput = {
    customer_id: form.value.customer_id,
    device_id: form.value.device_id,
    service_type: form.value.service_type,
    mikrotik_username: form.value.mikrotik_username.trim(),
    mikrotik_password: form.value.mikrotik_password,
  }
  if (form.value.service_type === 'pppoe' && form.value.ppp_profile_id > 0) {
    payload.ppp_profile_id = form.value.ppp_profile_id
  }
  if (form.value.service_type === 'hotspot' && form.value.hotspot_profile_id > 0) {
    payload.hotspot_profile_id = form.value.hotspot_profile_id
  }
  if (form.value.notes.trim()) payload.notes = form.value.notes.trim()
  emit('save', payload)
}
</script>

<template>
  <Modal
    :open="open"
    :title="isEdit ? 'Edit Langganan' : 'Tambah Langganan'"
    @close="emit('close')"
  >
    <div class="space-y-4">
      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Pelanggan
        </h3>
        <div class="space-y-3">
          <Field label="Pelanggan" required>
            <Select
              v-model="form.customer_id"
              :options="customerOptions"
              :disabled="isEdit || !!presetCustomerId"
            />
          </Field>
          <div
            class="rounded-lg p-3 text-[11px]"
            style="background: var(--bg-2); color: var(--muted)"
          >
            <template v-if="form.device_id">
              Device aktif: <span class="mono">#{{ form.device_id }}</span>.
              Ganti device dari router switcher di sidebar untuk pindah konteks.
            </template>
            <template v-else>
              Belum ada device aktif. Pilih device dari router switcher di sidebar terlebih dahulu.
            </template>
          </div>
        </div>
      </section>

      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Tipe Layanan & Paket
        </h3>
        <div class="space-y-3">
          <Field label="Tipe layanan" required>
            <div :class="{ 'pointer-events-none opacity-60': isEdit }">
              <Segmented
                v-model="form.service_type"
                :options="[
                  { value: 'pppoe', label: 'PPPoE' },
                  { value: 'hotspot', label: 'Hotspot Permanent' },
                ]"
              />
            </div>
          </Field>

          <!-- PPPoE profile -->
          <Field v-if="form.service_type === 'pppoe'" label="Profil PPP" required>
            <Select
              v-model="form.ppp_profile_id"
              :options="pppProfileOptions"
              :disabled="!form.device_id || pppProfileOptions.length <= 1"
            />
            <p
              v-if="form.device_id && pppProfileOptions.length <= 1"
              class="mt-1 text-[11px]"
              style="color: var(--warn)"
            >
              Belum ada profil PPP di device ini. Sync atau buat dulu di tab Profil (PPP).
            </p>
          </Field>

          <!-- Hotspot permanent profile -->
          <Field v-else label="Profil Hotspot" required>
            <Select
              v-model="form.hotspot_profile_id"
              :options="hotspotProfileOptions"
              :disabled="!form.device_id || hotspotProfileOptions.length <= 1"
            />
            <p
              v-if="form.device_id && hotspotProfileOptions.length <= 1"
              class="mt-1 text-[11px]"
              style="color: var(--warn)"
            >
              Belum ada profil Hotspot Permanent di device ini. Sync atau buat dulu di tab Profil (Hotspot).
            </p>
          </Field>
        </div>
      </section>

      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Kredensial MikroTik
        </h3>
        <div class="space-y-3">
          <Field label="Username" required hint="Akan dibuat di /ppp/secret atau /ip/hotspot/user">
            <Input
              v-model="form.mikrotik_username"
              placeholder="budi-001"
              :disabled="isEdit"
            />
          </Field>
          <Field
            :label="isEdit ? 'Password baru (opsional)' : 'Password'"
            :required="!isEdit"
            :hint="isEdit ? 'Kosongkan kalau tidak ingin ganti password.' : ''"
          >
            <div class="flex gap-2">
              <Input v-model="form.mikrotik_password" placeholder="" class="flex-1" />
              <button
                type="button"
                class="btn btn-sm"
                title="Generate password"
                @click="generatePassword"
              >
                <Icon name="RefreshCw" :size="13" />
              </button>
            </div>
          </Field>
        </div>
      </section>

      <section>
        <Field label="Catatan">
          <Input v-model="form.notes" placeholder="Pelanggan instalasi 25 Mei 2026" />
        </Field>
      </section>
    </div>
    <template #footer>
      <button class="btn btn-sm" type="button" @click="emit('close')">Batal</button>
      <button
        class="btn btn-primary btn-sm"
        type="button"
        :disabled="submitting || !canSubmit"
        @click="submit"
      >
        {{ submitting ? 'Menyimpan…' : isEdit ? 'Simpan' : 'Tambah' }}
      </button>
    </template>
  </Modal>
</template>
