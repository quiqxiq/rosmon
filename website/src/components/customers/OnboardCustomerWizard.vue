<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Field from '@/components/ui/Field.vue'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'
import Segmented from '@/components/ui/Segmented.vue'
import Icon from '@/components/ui/Icon.vue'
import { useCreateCustomerMutation } from '@/queries/customers.queries'
import { useCreateSubscriptionMutation } from '@/queries/subscriptions.queries'
import { useDevicesQuery } from '@/queries/devices.queries'
import { useBandwidthProfilesQuery } from '@/queries/bandwidth-profiles.queries'
import { useToast } from '@/composables/useToast'
import { extractApiError } from '@/utils/http-error'
import type { ServiceType } from '@/types/subscription'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'done'): void
}>()

const toast = useToast()
const createCustomer = useCreateCustomerMutation()
const createSubscription = useCreateSubscriptionMutation()
const { data: devices } = useDevicesQuery()

type Step = 1 | 2

const step = ref<Step>(1)
const skipSubscription = ref(false)

interface CustomerForm {
  full_name: string
  phone: string
  address: string
  area: string
  notes: string
}

interface SubscriptionForm {
  device_id: number
  bandwidth_profile_id: number
  service_type: ServiceType
  mikrotik_username: string
  mikrotik_password: string
}

const customerForm = ref<CustomerForm>({
  full_name: '',
  phone: '',
  address: '',
  area: '',
  notes: '',
})

const subscriptionForm = ref<SubscriptionForm>({
  device_id: 0,
  bandwidth_profile_id: 0,
  service_type: 'pppoe',
  mikrotik_username: '',
  mikrotik_password: '',
})

const createdCustomerId = ref<number | null>(null)
const partialWarning = ref<string | null>(null)

watch(
  () => props.open,
  (v) => {
    if (v) {
      step.value = 1
      skipSubscription.value = false
      customerForm.value = { full_name: '', phone: '', address: '', area: '', notes: '' }
      subscriptionForm.value = {
        device_id: 0,
        bandwidth_profile_id: 0,
        service_type: 'pppoe',
        mikrotik_username: '',
        mikrotik_password: '',
      }
      createdCustomerId.value = null
      partialWarning.value = null
    }
  },
)

const deviceIdStr = computed(() =>
  subscriptionForm.value.device_id > 0 ? String(subscriptionForm.value.device_id) : '',
)
const { data: bwProfiles } = useBandwidthProfilesQuery(deviceIdStr, () => ({
  service_type: subscriptionForm.value.service_type,
  only_active: true,
}))

watch(
  () => [subscriptionForm.value.device_id, subscriptionForm.value.service_type] as const,
  () => {
    subscriptionForm.value.bandwidth_profile_id = 0
  },
)

const deviceOptions = computed(() => [
  { value: 0, label: '— pilih device —' },
  ...(devices.value ?? []).map((d) => ({
    value: d.id,
    label: `${d.display_name} (${d.address})`,
  })),
])
const profileOptions = computed(() => [
  {
    value: 0,
    label: subscriptionForm.value.device_id ? '— pilih paket —' : '— pilih device dulu —',
  },
  ...(bwProfiles.value ?? []).map((p) => ({
    value: p.id,
    label: `${p.name} · ${p.rate_limit || 'unlimited'}`,
  })),
])

const canSubmitStep1 = computed(
  () => customerForm.value.full_name.trim() && customerForm.value.phone.trim(),
)

const canSubmitStep2 = computed(() => {
  if (skipSubscription.value) return true
  const s = subscriptionForm.value
  return (
    s.device_id > 0 &&
    s.bandwidth_profile_id > 0 &&
    s.mikrotik_username.trim().length > 0 &&
    s.mikrotik_password.length > 0
  )
})

async function submitStep1() {
  if (!canSubmitStep1.value || createCustomer.isPending.value) return
  try {
    const cust = await createCustomer.mutateAsync({
      full_name: customerForm.value.full_name.trim(),
      phone: customerForm.value.phone.trim(),
      address: customerForm.value.address.trim() || undefined,
      area: customerForm.value.area.trim() || undefined,
      notes: customerForm.value.notes.trim() || undefined,
    })
    createdCustomerId.value = cust.id
    step.value = 2
  } catch (e) {
    const err = extractApiError(e)
    toast.error(err.message || 'Gagal menyimpan pelanggan')
  }
}

async function submitStep2() {
  if (!createdCustomerId.value) return
  if (skipSubscription.value) {
    toast.success(`Pelanggan tersimpan, langganan bisa ditambah belakangan.`)
    emit('done')
    emit('close')
    return
  }
  if (!canSubmitStep2.value || createSubscription.isPending.value) return
  try {
    const s = subscriptionForm.value
    const res = await createSubscription.mutateAsync({
      customer_id: createdCustomerId.value,
      device_id: s.device_id,
      bandwidth_profile_id: s.bandwidth_profile_id,
      service_type: s.service_type,
      mikrotik_username: s.mikrotik_username.trim(),
      mikrotik_password: s.mikrotik_password,
    })
    if (res.warning) {
      toast.error(
        `Pelanggan & langganan tersimpan, sync MikroTik gagal: ${res.warning}. Coba reconcile dari detail.`,
      )
    } else {
      toast.success(`Pelanggan & langganan ${res.subscription.mikrotik_username} berhasil dibuat`)
    }
    emit('done')
    emit('close')
  } catch (e) {
    const err = extractApiError(e)
    partialWarning.value = `Pelanggan tersimpan (#${createdCustomerId.value}), tapi langganan gagal: ${err.message}. Anda bisa coba lagi dari halaman detail pelanggan.`
  }
}

function generatePassword() {
  const charset = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 10; i++) {
    s += charset[Math.floor(Math.random() * charset.length)]
  }
  subscriptionForm.value.mikrotik_password = s
}
</script>

<template>
  <Modal
    :open="open"
    :title="step === 1 ? 'Pelanggan Baru — Step 1' : 'Pelanggan Baru — Step 2'"
    @close="emit('close')"
  >
    <div class="space-y-4">
      <!-- Progress -->
      <div class="flex items-center gap-2">
        <div
          class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
          :style="`background: ${step >= 1 ? 'var(--accent-cyan)' : 'var(--bg-2)'}; color: ${step >= 1 ? 'white' : 'var(--muted)'}`"
        >
          1
        </div>
        <div
          class="h-0.5 flex-1"
          :style="`background: ${step >= 2 ? 'var(--accent-cyan)' : 'var(--border)'}`"
        />
        <div
          class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
          :style="`background: ${step >= 2 ? 'var(--accent-cyan)' : 'var(--bg-2)'}; color: ${step >= 2 ? 'white' : 'var(--muted)'}`"
        >
          2
        </div>
      </div>
      <p class="text-xs" style="color: var(--muted)">
        {{ step === 1 ? 'Data pelanggan' : 'Data langganan PPPoE/Hotspot' }}
      </p>

      <!-- Step 1: Customer -->
      <div v-if="step === 1" class="space-y-3">
        <Field label="Nama lengkap" required>
          <Input v-model="customerForm.full_name" placeholder="Pak Budi" />
        </Field>
        <Field label="No. WhatsApp" required>
          <Input v-model="customerForm.phone" placeholder="08111234567" />
        </Field>
        <Field label="Alamat">
          <Input v-model="customerForm.address" placeholder="Jl. Mawar 1" />
        </Field>
        <Field label="Area / RT-RW">
          <Input v-model="customerForm.area" placeholder="RT01 RW03" />
        </Field>
        <Field label="Catatan">
          <Input v-model="customerForm.notes" placeholder="Referral dari Bu Ani" />
        </Field>
      </div>

      <!-- Step 2: Subscription -->
      <div v-else class="space-y-3">
        <div
          v-if="partialWarning"
          class="rounded-lg p-3 text-xs"
          style="background: var(--danger-soft, var(--bg-2)); color: var(--danger); border-left: 3px solid var(--danger)"
        >
          {{ partialWarning }}
        </div>

        <div
          class="flex items-center gap-2 rounded-lg p-2.5 text-xs"
          style="background: var(--bg-2); color: var(--muted)"
        >
          <Icon name="Check" :size="13" style="color: var(--success)" />
          Pelanggan "{{ customerForm.full_name }}" tersimpan.
        </div>

        <div
          class="flex items-center justify-between rounded-lg p-3"
          style="background: var(--bg-2)"
        >
          <div>
            <div class="text-sm font-medium">Lewati pembuatan langganan</div>
            <div class="text-xs" style="color: var(--muted)">
              Pelanggan disimpan sebagai prospek, langganan bisa ditambah belakangan.
            </div>
          </div>
          <input
            v-model="skipSubscription"
            type="checkbox"
            class="h-4 w-4"
          />
        </div>

        <div v-if="!skipSubscription" class="space-y-3">
          <Field label="Tipe layanan" required>
            <Segmented
              v-model="subscriptionForm.service_type"
              :options="[
                { value: 'pppoe', label: 'PPPoE' },
                { value: 'hotspot', label: 'Hotspot Permanent' },
              ]"
            />
          </Field>
          <Field label="Device router" required>
            <Select v-model="subscriptionForm.device_id" :options="deviceOptions" />
          </Field>
          <Field label="Paket bandwidth" required>
            <Select
              v-model="subscriptionForm.bandwidth_profile_id"
              :options="profileOptions"
              :disabled="!subscriptionForm.device_id || profileOptions.length <= 1"
            />
            <p
              v-if="subscriptionForm.device_id && profileOptions.length <= 1"
              class="mt-1 text-[11px]"
              style="color: var(--warn)"
            >
              Belum ada paket aktif di device ini.
            </p>
          </Field>
          <Field label="Username MikroTik" required>
            <Input v-model="subscriptionForm.mikrotik_username" placeholder="budi-001" />
          </Field>
          <Field label="Password MikroTik" required>
            <div class="flex gap-2">
              <Input
                v-model="subscriptionForm.mikrotik_password"
                placeholder=""
                class="flex-1"
              />
              <button
                type="button"
                class="btn btn-sm"
                title="Generate"
                @click="generatePassword"
              >
                <Icon name="RefreshCw" :size="13" />
              </button>
            </div>
          </Field>
        </div>
      </div>
    </div>

    <template #footer>
      <button class="btn btn-sm" type="button" @click="emit('close')">
        {{ step === 2 && createdCustomerId ? 'Tutup' : 'Batal' }}
      </button>
      <div class="flex-1" />
      <button
        v-if="step === 1"
        class="btn btn-primary btn-sm"
        type="button"
        :disabled="!canSubmitStep1 || createCustomer.isPending.value"
        @click="submitStep1"
      >
        {{ createCustomer.isPending.value ? 'Menyimpan…' : 'Lanjut →' }}
      </button>
      <button
        v-else
        class="btn btn-primary btn-sm"
        type="button"
        :disabled="!canSubmitStep2 || createSubscription.isPending.value"
        @click="submitStep2"
      >
        {{
          createSubscription.isPending.value
            ? 'Menyimpan…'
            : skipSubscription
              ? 'Selesai'
              : 'Selesai ✓'
        }}
      </button>
    </template>
  </Modal>
</template>
