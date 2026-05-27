<script setup lang="ts">
import { ref, watch } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import Field from '@/components/ui/Field.vue'
import Input from '@/components/ui/Input.vue'
import Toggle from '@/components/ui/Toggle.vue'
import type { PPPProfileCreateInput } from '@/types/ppp'

// FormState internal: semua string defined supaya v-model Input typed strict.
// Saat submit, di-convert ke PPPProfileCreateInput (field kosong di-drop).
interface FormState {
  name: string
  local_address: string
  remote_address: string
  rate_limit: string
  session_timeout: string
  idle_timeout: string
  parent_queue: string
  on_up: string
  on_down: string
  comment: string
  disabled: boolean
}

const props = defineProps<{
  open: boolean
  // Kalau initial null → mode create. Kalau ada → mode edit (name di-disable).
  initial?: PPPProfileCreateInput | null
  submitting?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', p: PPPProfileCreateInput): void
}>()

const DEFAULT: FormState = {
  name: '',
  local_address: '',
  remote_address: '',
  rate_limit: '',
  session_timeout: '',
  idle_timeout: '',
  parent_queue: '',
  on_up: '',
  on_down: '',
  comment: '',
  disabled: false,
}

function fromInitial(v: PPPProfileCreateInput | null | undefined): FormState {
  if (!v) return { ...DEFAULT }
  return {
    name: v.name ?? '',
    local_address: v.local_address ?? '',
    remote_address: v.remote_address ?? '',
    rate_limit: v.rate_limit ?? '',
    session_timeout: v.session_timeout ?? '',
    idle_timeout: v.idle_timeout ?? '',
    parent_queue: v.parent_queue ?? '',
    on_up: v.on_up ?? '',
    on_down: v.on_down ?? '',
    comment: v.comment ?? '',
    disabled: v.disabled ?? false,
  }
}

const form = ref<FormState>({ ...DEFAULT })
const showScripts = ref(false)

watch(
  () => props.initial,
  (v) => {
    form.value = fromInitial(v)
    showScripts.value = Boolean(v?.on_up || v?.on_down)
  },
  { immediate: true },
)

const isEdit = () => Boolean(props.initial)

function submit() {
  if (!form.value.name.trim()) return
  const payload: PPPProfileCreateInput = { name: form.value.name.trim() }
  const keys = [
    'local_address',
    'remote_address',
    'rate_limit',
    'session_timeout',
    'idle_timeout',
    'parent_queue',
    'on_up',
    'on_down',
    'comment',
  ] as const
  for (const k of keys) {
    const v = form.value[k].trim()
    if (v) payload[k] = v
  }
  payload.disabled = form.value.disabled
  emit('save', payload)
}
</script>

<template>
  <Modal
    :open="open"
    :title="isEdit() ? 'Edit PPP Profile' : 'Tambah PPP Profile'"
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
          <Field label="Nama profile" required>
            <Input
              v-model="form.name"
              placeholder="paket-10M"
              :disabled="isEdit()"
            />
          </Field>
          <Field label="Comment" hint="Catatan internal (opsional)">
            <Input v-model="form.comment" placeholder="Paket rumah 10 Mbps" />
          </Field>
        </div>
      </section>

      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Address
        </h3>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Local address" hint="IP gateway server PPPoE">
            <Input v-model="form.local_address" placeholder="10.10.0.1" />
          </Field>
          <Field label="Remote address" hint="IP atau nama pool client">
            <Input v-model="form.remote_address" placeholder="pool-rumah" />
          </Field>
          <Field
            label="Parent queue"
            hint="Reference queue tree (opsional)"
            class="sm:col-span-2"
          >
            <Input v-model="form.parent_queue" placeholder="queue-rumah" />
          </Field>
        </div>
      </section>

      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Limits
        </h3>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Rate limit (RX/TX)" hint="Format MikroTik, mis. 10M/10M">
            <Input v-model="form.rate_limit" placeholder="10M/10M" />
          </Field>
          <Field label="Session timeout" hint="Durasi RouterOS, mis. 12h">
            <Input v-model="form.session_timeout" placeholder="" />
          </Field>
          <Field label="Idle timeout" hint="Disconnect kalau idle (mis. 10m)">
            <Input v-model="form.idle_timeout" placeholder="" />
          </Field>
        </div>
      </section>

      <section>
        <button
          type="button"
          class="flex items-center gap-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
          @click="showScripts = !showScripts"
        >
          Scripts (advanced)
          <span class="text-xs">{{ showScripts ? '−' : '+' }}</span>
        </button>
        <div v-if="showScripts" class="mt-2 space-y-3">
          <Field label="On-up script" hint="Dieksekusi saat user terhubung">
            <Input v-model="form.on_up" placeholder="" />
          </Field>
          <Field label="On-down script" hint="Dieksekusi saat user disconnect">
            <Input v-model="form.on_down" placeholder="" />
          </Field>
        </div>
      </section>

      <section>
        <div
          class="flex items-center justify-between rounded-lg p-3"
          style="background: var(--bg-2)"
        >
          <div>
            <div class="text-sm font-medium">Disabled</div>
            <div class="text-xs" style="color: var(--muted)">
              Profile tidak akan dipakai user baru bila aktif
            </div>
          </div>
          <Toggle v-model="form.disabled" />
        </div>
      </section>
    </div>

    <template #footer>
      <button class="btn btn-sm" type="button" @click="emit('close')">Batal</button>
      <button
        class="btn btn-primary btn-sm"
        type="button"
        :disabled="submitting || !form.name.trim()"
        @click="submit"
      >
        {{ submitting ? 'Menyimpan…' : isEdit() ? 'Simpan' : 'Tambah' }}
      </button>
    </template>
  </Modal>
</template>
