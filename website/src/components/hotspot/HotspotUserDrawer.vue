<script setup lang="ts">
import { ref, watch } from 'vue'
import Drawer from '@/components/ui/Drawer.vue'
import Field from '@/components/ui/Field.vue'
import Input from '@/components/ui/Input.vue'
import Select from '@/components/ui/Select.vue'
import Tabs from '@/components/ui/Tabs.vue'
import Toggle from '@/components/ui/Toggle.vue'
import { HS_PROFILES, type FixtureHotspotUser } from '@/fixtures/hotspot'

const props = defineProps<{
  open: boolean
  user: Partial<FixtureHotspotUser> | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', user: Partial<FixtureHotspotUser>): void
  (e: 'delete', id: string): void
}>()

type TabId = 'general' | 'limits' | 'stats'
const tab = ref<TabId>('general')
const form = ref<Partial<FixtureHotspotUser>>({})

watch(
  () => props.user,
  (u) => {
    form.value = { ...(u ?? {}) }
    tab.value = 'general'
  },
  { immediate: true },
)

const isEdit = () => Boolean(props.user?.id)
</script>

<template>
  <Drawer :open="open" :title="isEdit() ? 'Edit Hotspot User' : 'Tambah Hotspot User'" @close="emit('close')">
    <Tabs
      v-model="tab"
      :tabs="[
        { id: 'general', label: 'General' },
        { id: 'limits', label: 'Limits' },
        { id: 'stats', label: 'Statistik' },
      ]"
      class="mb-4"
    />

    <div v-if="tab === 'general'" class="space-y-3">
      <Field label="Username" required>
        <Input v-model="form.name as string" placeholder="contoh: budi100" />
      </Field>
      <Field label="Password">
        <Input v-model="form.comment as string" placeholder="auto-generate jika kosong" />
      </Field>
      <Field label="Profile">
        <Select
          :model-value="form.profile ?? HS_PROFILES[0].name"
          :options="HS_PROFILES.map((p) => ({ value: p.name, label: p.name }))"
          @update:model-value="(v) => (form.profile = v)"
        />
      </Field>
      <Field label="Server">
        <Select
          :model-value="form.server ?? 'hotspot1'"
          :options="[
            { value: 'hotspot1', label: 'hotspot1' },
            { value: 'hotspot2', label: 'hotspot2' },
          ]"
          @update:model-value="(v) => (form.server = v)"
        />
      </Field>
      <Field label="MAC Address (opsional)">
        <Input v-model="form.mac as string" placeholder="AA:BB:CC:DD:EE:FF" />
      </Field>
      <Field label="Comment">
        <Input v-model="form.comment as string" placeholder="" />
      </Field>
      <div class="flex items-center justify-between rounded-lg p-3" style="background: var(--bg-2)">
        <div>
          <div class="text-sm font-medium">Disabled</div>
          <div class="text-xs" style="color: var(--muted)">User tidak dapat login</div>
        </div>
        <Toggle v-model="form.disabled as boolean" />
      </div>
    </div>

    <div v-else-if="tab === 'limits'" class="space-y-3">
      <Field label="Validity">
        <Select
          :model-value="'1d'"
          :options="HS_PROFILES.map((p) => ({ value: p.validity, label: p.validity }))"
        />
      </Field>
      <Field label="Uptime limit">
        <Input :model-value="''" placeholder="contoh: 4h, 1d" />
      </Field>
      <Field label="Bytes total limit">
        <Input :model-value="''" placeholder="contoh: 5G" />
      </Field>
      <div
        class="rounded-lg p-3 text-xs"
        style="background: var(--accent-cyan-soft); color: var(--accent-cyan)"
      >
        Limits dari profile akan menjadi default. Override hanya jika perlu.
      </div>
    </div>

    <div v-else-if="tab === 'stats'" class="space-y-3 text-sm">
      <div v-if="isEdit()">
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-lg p-3" style="background: var(--bg-2)">
            <div class="text-xs" style="color: var(--muted)">Uptime</div>
            <div class="mono font-semibold">{{ form.uptime ?? 0 }}s</div>
          </div>
          <div class="rounded-lg p-3" style="background: var(--bg-2)">
            <div class="text-xs" style="color: var(--muted)">Last session</div>
            <div class="mono font-semibold">—</div>
          </div>
          <div class="rounded-lg p-3" style="background: var(--bg-2)">
            <div class="text-xs" style="color: var(--muted)">Bytes In</div>
            <div class="mono font-semibold">{{ form.bytesIn ?? 0 }}</div>
          </div>
          <div class="rounded-lg p-3" style="background: var(--bg-2)">
            <div class="text-xs" style="color: var(--muted)">Bytes Out</div>
            <div class="mono font-semibold">{{ form.bytesOut ?? 0 }}</div>
          </div>
        </div>
      </div>
      <div v-else style="color: var(--muted)">Tersedia setelah user disimpan.</div>
    </div>

    <template #footer>
      <button v-if="isEdit()" class="btn btn-danger btn-sm" type="button" @click="emit('delete', form.id as string)">
        Hapus
      </button>
      <div class="flex-1" />
      <button class="btn btn-sm" type="button" @click="emit('close')">Batal</button>
      <button class="btn btn-primary btn-sm" type="button" @click="emit('save', form)">
        {{ isEdit() ? 'Simpan' : 'Buat' }}
      </button>
    </template>
  </Drawer>
</template>
