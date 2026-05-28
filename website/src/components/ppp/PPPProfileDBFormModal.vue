<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Field from '@/components/ui/Field.vue'
import Input from '@/components/ui/Input.vue'
import Toggle from '@/components/ui/Toggle.vue'
import type { PPPProfileDB, PPPProfileDBCreateInput, PPPProfileDBUpdateInput } from '@/types/ppp-profile-db'

const props = defineProps<{
  open: boolean
  initial?: PPPProfileDB | null
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: PPPProfileDBCreateInput | PPPProfileDBUpdateInput): void
}>()

interface FormState {
  name: string
  rate_limit: string
  price_monthly: string
  description: string
  active: boolean
}

const DEFAULT: FormState = {
  name: '',
  rate_limit: '',
  price_monthly: '',
  description: '',
  active: true,
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
        rate_limit: init.rate_limit ?? '',
        price_monthly: init.price_monthly ? String(init.price_monthly) : '',
        description: init.description ?? '',
        active: init.active,
      }
    } else {
      form.value = { ...DEFAULT }
    }
  },
  { immediate: true },
)

function submit() {
  if (!form.value.name.trim() && !isEdit.value) return
  if (isEdit.value) {
    const payload: PPPProfileDBUpdateInput = {}
    if (form.value.rate_limit.trim()) payload.rate_limit = form.value.rate_limit.trim()
    const pm = Number(form.value.price_monthly)
    if (!isNaN(pm)) payload.price_monthly = pm
    if (form.value.description.trim()) payload.description = form.value.description.trim()
    payload.active = form.value.active
    emit('save', payload)
  } else {
    const payload: PPPProfileDBCreateInput = { name: form.value.name.trim() }
    if (form.value.rate_limit.trim()) payload.rate_limit = form.value.rate_limit.trim()
    const pm = Number(form.value.price_monthly)
    if (!isNaN(pm) && pm > 0) payload.price_monthly = pm
    if (form.value.description.trim()) payload.description = form.value.description.trim()
    payload.active = form.value.active
    emit('save', payload)
  }
}
</script>

<template>
  <Modal
    :open="open"
    :title="isEdit ? 'Edit Profil PPP' : 'Tambah Profil PPP'"
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
              placeholder="paket-10M"
              :disabled="isEdit"
            />
          </Field>
          <Field label="Rate Limit" hint="Format MikroTik, mis. 10M/10M">
            <Input v-model="form.rate_limit" placeholder="10M/10M" />
          </Field>
          <Field label="Deskripsi">
            <Input v-model="form.description" placeholder="Paket rumah 10 Mbps" />
          </Field>
        </div>
      </section>

      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Billing
        </h3>
        <Field label="Harga / Bulan (Rp)" hint="Nominal tagihan bulanan untuk paket ini">
          <Input
            v-model="form.price_monthly"
            placeholder="150000"
            type="number"
            min="0"
          />
        </Field>
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
