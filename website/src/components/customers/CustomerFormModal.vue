<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Field from '@/components/ui/Field.vue'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'
import type { Customer, CustomerCreateInput } from '@/types/customer'

interface FormState {
  full_name: string
  phone: string
  address: string
  area: string
  notes: string
  status: 'aktif' | 'nonaktif'
}

const props = defineProps<{
  open: boolean
  // Kalau initial null → mode create. Kalau ada → mode edit.
  initial?: Customer | null
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: CustomerCreateInput): void
}>()

const DEFAULT: FormState = {
  full_name: '',
  phone: '',
  address: '',
  area: '',
  notes: '',
  status: 'aktif',
}

const form = ref<FormState>({ ...DEFAULT })

watch(
  () => props.initial,
  (v) => {
    form.value = v
      ? {
          full_name: v.full_name,
          phone: v.phone,
          address: v.address,
          area: v.area,
          notes: v.notes,
          status: v.status,
        }
      : { ...DEFAULT }
  },
  { immediate: true },
)

const isEdit = computed(() => Boolean(props.initial))

function submit() {
  if (!form.value.full_name.trim() || !form.value.phone.trim()) return
  const payload: CustomerCreateInput = {
    full_name: form.value.full_name.trim(),
    phone: form.value.phone.trim(),
    status: form.value.status,
  }
  if (form.value.address.trim()) payload.address = form.value.address.trim()
  if (form.value.area.trim()) payload.area = form.value.area.trim()
  if (form.value.notes.trim()) payload.notes = form.value.notes.trim()
  emit('save', payload)
}
</script>

<template>
  <Modal
    :open="open"
    :title="isEdit ? 'Edit Pelanggan' : 'Tambah Pelanggan'"
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
          <Field label="Nama lengkap" required>
            <Input v-model="form.full_name" placeholder="Pak Budi" />
          </Field>
          <Field label="No. WhatsApp" required hint="Format apa saja, mis. 0811xxxxxxxx">
            <Input v-model="form.phone" placeholder="08111234567" />
          </Field>
        </div>
      </section>

      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Alamat
        </h3>
        <div class="space-y-3">
          <Field label="Alamat lengkap">
            <Input v-model="form.address" placeholder="Jl. Mawar No. 1" />
          </Field>
          <Field label="Area / RT-RW" hint="Untuk filter laporan per wilayah">
            <Input v-model="form.area" placeholder="RT01 RW03" />
          </Field>
        </div>
      </section>

      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Catatan & Status
        </h3>
        <div class="space-y-3">
          <Field label="Catatan internal">
            <Input v-model="form.notes" placeholder="Pelanggan referral dari Bu Ani" />
          </Field>
          <Field label="Status">
            <Select
              v-model="form.status"
              :options="[
                { value: 'aktif', label: 'Aktif' },
                { value: 'nonaktif', label: 'Non-aktif' },
              ]"
            />
          </Field>
        </div>
      </section>
    </div>
    <template #footer>
      <button class="btn btn-sm" type="button" @click="emit('close')">Batal</button>
      <button
        class="btn btn-primary btn-sm"
        type="button"
        :disabled="submitting || !form.full_name.trim() || !form.phone.trim()"
        @click="submit"
      >
        {{ submitting ? 'Menyimpan…' : isEdit ? 'Simpan' : 'Tambah' }}
      </button>
    </template>
  </Modal>
</template>
