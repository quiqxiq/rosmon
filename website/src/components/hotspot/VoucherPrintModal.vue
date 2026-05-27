<script setup lang="ts">
import { computed, ref } from 'vue'
import Modal from '@/components/ui/Modal.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import Select from '@/components/ui/Select.vue'
import Icon from '@/components/ui/Icon.vue'
import { fmtRp } from '@/utils/fmt'
import { useTweaksStore } from '@/stores/tweaks'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { useHotspotUsersQuery } from '@/queries/hotspot.queries'
import type { ProfileConfig } from '@/types/profile-config'
import type { GeneratedVoucher } from '@/types/hotspot'
import VoucherTemplateDefault from './voucher-templates/VoucherTemplateDefault.vue'
import VoucherTemplateSmall from './voucher-templates/VoucherTemplateSmall.vue'
import VoucherTemplateThermal from './voucher-templates/VoucherTemplateThermal.vue'

interface DisplayUser {
  id: string
  name: string
  password: string
  comment: string
  profile: string
}

const props = defineProps<{
  open: boolean
  // Lookup validity/price untuk existing hotspot users
  profileConfigs?: ProfileConfig[]
  // Kalau diisi: mode generated — tampilkan langsung tanpa query hotspot users
  generatedVouchers?: GeneratedVoucher[]
  generatedMode?: 'vc' | 'up'
  generatedValidity?: string
  generatedPrice?: number
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const store = useTweaksStore()
const { activeDeviceId } = useActiveDevice()
const { data: apiUsers } = useHotspotUsersQuery(activeDeviceId)

const search = ref('')
const filterComment = ref('all')
const selectedIds = ref<string[]>([])

// Apakah modal sedang dipakai untuk print voucher hasil generate
const isGeneratedMode = computed(() => !!props.generatedVouchers?.length)

// Daftar users yang bisa dipilih (existing atau generated)
const existingUsers = computed(() => {
  return (apiUsers.value ?? []).filter((u) => {
    if (search.value) {
      const s = search.value.toLowerCase()
      if (!u.name.toLowerCase().includes(s) && !(u.comment || '').toLowerCase().includes(s))
        return false
    }
    if (filterComment.value !== 'all') {
      if (filterComment.value === 'with-comment') return !!u.comment
      if (filterComment.value === 'no-comment') return !u.comment
      if (!u.comment?.includes(filterComment.value)) return false
    }
    return true
  })
})

const generatedDisplayList = computed<DisplayUser[]>(() =>
  (props.generatedVouchers ?? []).map((v) => ({
    id: v.id || v.username,
    name: v.username,
    password: v.password,
    comment: '',
    profile: '',
  })),
)

const comments = computed(() => {
  const set = new Set<string>()
  ;(apiUsers.value ?? []).forEach((u) => {
    if (u.comment) set.add(u.comment)
  })
  return Array.from(set)
})

// Untuk existing users: manage selection; untuk generated: semua sudah ter-select
const allSelected = computed(() => {
  if (!existingUsers.value.length) return false
  return existingUsers.value.every((u) => selectedIds.value.includes(u.id))
})

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = selectedIds.value.filter((id) => !existingUsers.value.find((u) => u.id === id))
  } else {
    const newIds = existingUsers.value.map((u) => u.id)
    selectedIds.value = Array.from(new Set([...selectedIds.value, ...newIds]))
  }
}

function toggleOne(id: string) {
  if (selectedIds.value.includes(id)) {
    selectedIds.value = selectedIds.value.filter((x) => x !== id)
  } else {
    selectedIds.value.push(id)
  }
}

// Users yang akan di-print
const selectedUsers = computed<DisplayUser[]>(() => {
  if (isGeneratedMode.value) return generatedDisplayList.value
  return (apiUsers.value ?? [])
    .filter((u) => selectedIds.value.includes(u.id))
    .map((u) => ({
      id: u.id,
      name: u.name,
      password: u.name, // existing user: mikhmon convention password=username
      comment: u.comment ?? '',
      profile: u.profile,
    }))
})

// Template component berdasarkan pilihan
const templateComponent = computed(() => {
  const t = store.defaultVoucherTemplate
  if (t === 'small') return VoucherTemplateSmall
  if (t === 'thermal') return VoucherTemplateThermal
  return VoucherTemplateDefault
})

// user_mode: generated pakai mode dari generate request, existing pakai 'vc'
const printUserMode = computed<'vc' | 'up'>(() => {
  if (isGeneratedMode.value) return props.generatedMode ?? 'vc'
  return 'vc'
})

// Helpers untuk template props
const configByProfile = computed(() => {
  const map = new Map<string, ProfileConfig>()
  ;(props.profileConfigs ?? []).forEach((c) => map.set(c.profile_name, c))
  return map
})

function getValidity(u: DisplayUser): string {
  if (isGeneratedMode.value) return props.generatedValidity ?? ''
  return configByProfile.value.get(u.profile)?.validity ?? ''
}

function getPrice(u: DisplayUser): string {
  if (isGeneratedMode.value) return props.generatedPrice ? fmtRp(props.generatedPrice) : ''
  const cfg = configByProfile.value.get(u.profile)
  const p = cfg?.sell_price || cfg?.price || 0
  return p ? fmtRp(p) : ''
}

function getPassword(u: DisplayUser): string {
  return u.password
}

function doPrint() {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Pop-up diblokir browser. Izinkan pop-up untuk halaman ini dan coba lagi.')
    return
  }

  const style = `
    <style>
      body { margin: 0; padding: 4px; background: #fff; font-size: 0; }
      .voucher-wrap { display: inline-block; vertical-align: top; margin: 2px; font-size: 12px; }
      @media print {
        body { margin: 0; padding: 2px; }
        .no-print { display: none !important; }
        .voucher-wrap { page-break-inside: avoid; }
      }
    </style>
  `

  const preview = document.getElementById('voucher-preview-area')
  const content = preview ? preview.innerHTML : ''

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head><title>Voucher Print</title>${style}</head>
<body>${content}</body>
</html>`)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
  }, 300)
}

const printCount = computed(() =>
  isGeneratedMode.value ? generatedDisplayList.value.length : selectedIds.value.length,
)
</script>

<template>
  <Modal :open="props.open" title="Print Voucher" size="lg" @close="emit('close')">
    <div class="flex flex-col gap-4 md:flex-row">
      <!-- Left panel: user selection (hanya tampil untuk existing users) -->
      <div v-if="!isGeneratedMode" class="flex-1 space-y-3">
        <div class="flex flex-wrap gap-2">
          <SearchInput v-model="search" placeholder="Cari user / comment..." class="flex-1" />
          <Select
            v-model="filterComment"
            sm
            :options="[
              { value: 'all', label: 'Semua' },
              { value: 'with-comment', label: 'Ada comment' },
              { value: 'no-comment', label: 'Tanpa comment' },
              ...comments.map((c) => ({ value: c, label: c })),
            ]"
          />
        </div>

        <div
          class="max-h-[360px] overflow-auto rounded-lg border"
          style="border-color: var(--border)"
        >
          <table class="w-full text-sm">
            <thead class="sticky top-0" style="background: var(--bg-2)">
              <tr>
                <th class="px-3 py-2 text-left">
                  <input type="checkbox" :checked="allSelected" @change="toggleSelectAll" />
                </th>
                <th class="px-3 py-2 text-left">User</th>
                <th class="px-3 py-2 text-left">Comment</th>
                <th class="px-3 py-2 text-left">Profile</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="u in existingUsers"
                :key="u.id"
                class="cursor-pointer border-t transition-colors hover:bg-[var(--bg-2)]"
                style="border-color: var(--border)"
                @click="toggleOne(u.id)"
              >
                <td class="px-3 py-2">
                  <input
                    type="checkbox"
                    :checked="selectedIds.includes(u.id)"
                    @click.stop
                    @change="toggleOne(u.id)"
                  />
                </td>
                <td class="px-3 py-2 font-medium">{{ u.name }}</td>
                <td class="px-3 py-2 text-xs" style="color: var(--muted)">
                  {{ u.comment || '—' }}
                </td>
                <td class="px-3 py-2 text-xs">{{ u.profile }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-xs" style="color: var(--muted)">{{ selectedIds.length }} user terpilih</div>
      </div>

      <!-- Generated mode: header info -->
      <div v-else class="flex-1">
        <div
          class="flex items-center gap-2 rounded-lg p-3"
          style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25)"
        >
          <Icon name="Check" :size="16" style="color: var(--success)" />
          <div>
            <div class="text-sm font-semibold" style="color: var(--success)">
              {{ generatedDisplayList.length }} voucher siap cetak
            </div>
            <div class="text-xs" style="color: var(--muted)">
              Mode: {{ generatedMode === 'up' ? 'User + Password' : 'Voucher Code' }}
              <template v-if="generatedValidity"> · Validity: {{ generatedValidity }}</template>
            </div>
          </div>
        </div>

        <!-- List singkat voucher yang akan dicetak -->
        <div class="mt-3 max-h-[280px] overflow-auto rounded-lg border" style="border-color: var(--border)">
          <table class="w-full text-sm">
            <thead class="sticky top-0" style="background: var(--bg-2)">
              <tr>
                <th class="px-3 py-1.5 text-left text-xs">No</th>
                <th class="px-3 py-1.5 text-left text-xs">Username</th>
                <th v-if="generatedMode === 'up'" class="px-3 py-1.5 text-left text-xs">Password</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(v, i) in generatedDisplayList"
                :key="v.id"
                class="border-t"
                style="border-color: var(--border)"
              >
                <td class="mono px-3 py-1 text-xs" style="color: var(--muted)">{{ i + 1 }}</td>
                <td class="mono px-3 py-1 text-xs font-medium">{{ v.name }}</td>
                <td v-if="generatedMode === 'up'" class="mono px-3 py-1 text-xs">{{ v.password }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Right panel: template selector + preview -->
      <div class="w-full md:w-[360px] md:shrink-0">
        <div class="mb-2 flex items-center justify-between">
          <div class="text-xs font-medium" style="color: var(--muted)">Template</div>
          <Select
            v-model="store.defaultVoucherTemplate"
            sm
            :options="[
              { value: 'default', label: 'Default' },
              { value: 'small', label: 'Kecil' },
              { value: 'thermal', label: 'Thermal' },
            ]"
          />
        </div>
        <div
          id="voucher-preview-area"
          class="overflow-y-auto rounded-lg border p-2"
          style="border-color: var(--border); background: #f5f5f5; max-height: 380px; min-height: 120px"
        >
          <component
            :is="templateComponent"
            v-for="(u, i) in selectedUsers"
            :key="u.id"
            hotspot-name="Mikhmon Hotspot"
            :num="i + 1"
            :user-mode="printUserMode"
            :username="u.name"
            :password="getPassword(u)"
            :validity="getValidity(u)"
            :price="getPrice(u)"
            time-limit=""
            data-limit=""
            dns-name="hotspot.local"
          />
          <div v-if="!selectedUsers.length" class="flex h-24 items-center justify-center">
            <span class="text-sm" style="color: var(--muted)">Pilih user untuk melihat preview</span>
          </div>
        </div>
        <div v-if="selectedUsers.length" class="mt-1.5 text-right text-xs" style="color: var(--muted)">
          {{ selectedUsers.length }} voucher
        </div>
      </div>
    </div>

    <template #footer>
      <button class="btn btn-sm" type="button" @click="emit('close')">Batal</button>
      <button
        class="btn btn-primary btn-sm"
        type="button"
        :disabled="!printCount"
        @click="doPrint"
      >
        <Icon name="Printer" :size="13" />
        Print {{ printCount ? `(${printCount})` : '' }}
      </button>
    </template>
  </Modal>
</template>
