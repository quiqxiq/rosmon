<script setup lang="ts">
import { computed, h, ref } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import Badge from '@/components/ui/Badge.vue'
import Card from '@/components/ui/Card.vue'
import DataTable from '@/components/ui/DataTable.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import Select from '@/components/ui/Select.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import type { Device } from '@/types/device'
import {
  useDevicesQuery,
  useCreateDeviceMutation,
  useUpdateDeviceMutation,
  useRemoveDeviceMutation,
} from '@/queries/devices.queries'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { useToast } from '@/composables/useToast'

const { activeDeviceId, setActiveDevice } = useActiveDevice()
const toast = useToast()

const { data: devices, isPending, isError, refetch } = useDevicesQuery()
const createMutation = useCreateDeviceMutation()
const updateMutation = useUpdateDeviceMutation()
const removeMutation = useRemoveDeviceMutation()

const search = ref('')
const filterStatus = ref<string>('all')

// Form tambah device
const showAddForm = ref(false)
const addForm = ref({
  slug: '',
  displayName: '',
  address: '',
  username: '',
  password: '',
  useTls: false,
  expiryCheckInterval: '2m',
})

async function submitAdd() {
  try {
    const result = await createMutation.mutateAsync(addForm.value)
    toast.success(`Device "${result.device.displayName}" berhasil ditambahkan`)
    if (result.warning) toast.error(result.warning)
    showAddForm.value = false
    addForm.value = { slug: '', displayName: '', address: '', username: '', password: '', useTls: false, expiryCheckInterval: '2m' }
  } catch {
    toast.error('Gagal menambahkan device')
  }
}

// Form edit/update device
const showEditForm = ref(false)
const editingDeviceId = ref<string>('')
const editForm = ref({
  displayName: '',
  address: '',
  username: '',
  password: '',
  useTls: false,
  expiryCheckInterval: '2m',
})

function openEdit(d: Device) {
  editingDeviceId.value = String(d.id)
  editForm.value = {
    displayName: d.displayName,
    address: d.address,
    username: d.username,
    password: '', // Kosongkan password, hanya diisi jika ingin diubah
    useTls: d.useTls,
    expiryCheckInterval: d.expiryCheckInterval || '2m',
  }
  showEditForm.value = true
}

async function submitEdit() {
  try {
    const payload: any = { ...editForm.value }
    if (!payload.password) {
      delete payload.password
    }
    const result = await updateMutation.mutateAsync({
      id: editingDeviceId.value,
      input: payload,
    })
    toast.success(`Device "${result.device.displayName}" berhasil diperbarui`)
    if (result.warning) toast.error(result.warning)
    showEditForm.value = false
  } catch {
    toast.error('Gagal memperbarui device')
  }
}

// Konfirmasi Hapus Device
const showDeleteConfirm = ref(false)
const deletingDevice = ref<Device | null>(null)

function confirmDelete(d: Device) {
  deletingDevice.value = d
  showDeleteConfirm.value = true
}

async function submitDelete() {
  if (!deletingDevice.value) return
  const idStr = String(deletingDevice.value.id)
  const name = deletingDevice.value.displayName
  try {
    await removeMutation.mutateAsync(idStr)
    toast.success(`Device "${name}" berhasil dihapus`)
    if (String(activeDeviceId.value) === idStr) {
      setActiveDevice(null)
    }
    showDeleteConfirm.value = false
    deletingDevice.value = null
  } catch {
    toast.error('Gagal menghapus device')
  }
}

const filteredDevices = computed(() => {
  const list = devices.value ?? []
  return list.filter((d) => {
    if (search.value) {
      const s = search.value.toLowerCase()
      if (
        !d.displayName.toLowerCase().includes(s) &&
        !d.slug.toLowerCase().includes(s) &&
        !d.address.toLowerCase().includes(s)
      )
        return false
    }
    if (filterStatus.value !== 'all' && d.status !== filterStatus.value) return false
    return true
  })
})

const totals = computed(() => {
  const list = devices.value ?? []
  return {
    devices: list.length,
    online: list.filter((d) => d.status === 'connected').length,
    offline: list.filter((d) => d.status === 'disconnected').length,
    active: list.filter((d) => d.active).length,
  }
})

const statusTone = (s: string) =>
  s === 'connected' ? 'success' : s === 'connecting' ? 'warn' : s === 'error' ? 'danger' : 'neutral'

const statusLabel = (s: string) =>
  ({ connected: 'Online', disconnected: 'Offline', connecting: 'Connecting', error: 'Error' })[s] ?? s

const columns = computed<ColumnDef<Device>[]>(() => [
  {
    accessorKey: 'displayName',
    header: 'Device',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2.5' }, [
        h(
          'div',
          {
            class: 'relative flex h-9 w-9 items-center justify-center rounded-lg',
            style: `background: ${activeDeviceId.value === String(row.original.id) ? 'var(--accent-cyan-soft)' : 'var(--bg-2)'}; border: 1px solid var(--border)`,
          },
          [
            h(Icon, {
              name: 'Server',
              size: 15,
              style: { color: activeDeviceId.value === String(row.original.id) ? 'var(--accent-cyan)' : 'var(--muted)' },
            }),
          ],
        ),
        h('div', null, [
          h('div', { class: 'text-[13px] font-medium' }, row.original.displayName),
          h('div', { class: 'text-[11px] mono', style: 'color: var(--muted)' }, row.original.slug),
        ]),
      ]),
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.address),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const s = row.original.status
      return h(Badge, { tone: statusTone(s), dot: true }, () => statusLabel(s))
    },
  },
  {
    accessorKey: 'lastSeen',
    header: 'Last Seen',
    cell: ({ row }) => {
      const ls = row.original.lastSeen
      if (!ls) return h('span', { style: 'color: var(--muted)' }, '—')
      const d = new Date(ls)
      return h('span', { class: 'text-[12px]' }, d.toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }))
    },
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'username',
    header: 'User',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.username),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'active',
    header: 'Enabled',
    cell: ({ row }) =>
      h(Badge, { tone: row.original.active ? 'success' : 'neutral' }, () => (row.original.active ? 'Active' : 'Inactive')),
    meta: { align: 'right' },
  },
  {
    id: '__actions',
    header: '',
    enableSorting: false,
    cell: ({ row }) => {
      const isActive = activeDeviceId.value === String(row.original.id)
      return h('div', { class: 'flex items-center gap-1.5 justify-end' }, [
        h(
          'button',
          {
            class: `btn btn-xs ${isActive ? 'btn-ghost' : 'btn-primary'}`,
            type: 'button',
            disabled: isActive,
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              setActiveDevice(String(row.original.id))
              toast.success(`Device aktif: ${row.original.slug}`)
            },
          },
          isActive ? 'Aktif' : 'Select',
        ),
        h(
          'button',
          {
            class: 'btn btn-ghost btn-icon btn-xs',
            type: 'button',
            title: 'Edit',
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              openEdit(row.original)
            },
          },
          [h(Icon, { name: 'Edit', size: 13 })]
        ),
        h(
          'button',
          {
            class: 'btn btn-ghost btn-icon btn-xs',
            style: 'color: var(--danger)',
            type: 'button',
            title: 'Hapus',
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              confirmDelete(row.original)
            },
          },
          [h(Icon, { name: 'Trash', size: 13 })]
        ),
      ])
    },
    meta: { align: 'right' },
  },
])
</script>

<template>
  <div class="fade-in">
    <PageHeader title="Devices" subtitle="Daftar router yang dikelola">
      <template #right>
        <button class="btn btn-sm" type="button" :disabled="isPending" @click="refetch()">
          <Icon name="Refresh" :size="13" />
          Reload
        </button>
        <button class="btn btn-primary btn-sm" type="button" @click="showAddForm = true">
          <Icon name="Plus" :size="14" />
          Tambah Device
        </button>
      </template>
    </PageHeader>

    <!-- KPI Summary -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
      <Card>
        <div class="text-xs" style="color: var(--muted)">Total</div>
        <div class="mt-1 text-2xl font-semibold tabular">{{ totals.devices }}</div>
      </Card>
      <Card>
        <div class="text-xs" style="color: var(--muted)">Online</div>
        <div class="mt-1 text-2xl font-semibold tabular" style="color: var(--success)">{{ totals.online }}</div>
      </Card>
      <Card>
        <div class="text-xs" style="color: var(--muted)">Offline</div>
        <div class="mt-1 text-2xl font-semibold tabular" style="color: var(--muted)">{{ totals.offline }}</div>
      </Card>
      <Card>
        <div class="text-xs" style="color: var(--muted)">Enabled</div>
        <div class="mt-1 text-2xl font-semibold tabular" style="color: var(--accent-cyan)">{{ totals.active }}</div>
      </Card>
    </div>

    <!-- Error state -->
    <div v-if="isError" class="card mb-4 flex items-center gap-3" style="border-color: var(--danger)">
      <Icon name="AlertCircle" :size="16" style="color: var(--danger)" />
      <span class="text-sm">Gagal memuat daftar device. Pastikan backend berjalan.</span>
      <button class="btn btn-xs ml-auto" @click="refetch()">Coba lagi</button>
    </div>

    <DataTable
      :columns="columns"
      :data="filteredDevices"
      :get-row-id="(d) => String(d.id)"
      :global-filter="search"
      :page-size="8"
      :loading="isPending"
      empty-message="Tidak ada device yang cocok dengan filter"
      @update:global-filter="(v) => (search = v)"
    >
      <template #toolbar>
        <SearchInput v-model="search" placeholder="Cari nama, slug, address..." />
        <Select
          v-model="filterStatus"
          sm
          :options="[
            { value: 'all', label: 'Semua status' },
            { value: 'connected', label: 'Online' },
            { value: 'connecting', label: 'Connecting' },
            { value: 'disconnected', label: 'Offline' },
            { value: 'error', label: 'Error' },
          ]"
        />
      </template>
    </DataTable>

    <!-- Add Device Modal -->
    <div
      v-if="showAddForm"
      class="fixed inset-0 z-50 flex items-center justify-center"
      style="background: rgba(0,0,0,0.6)"
      @click.self="showAddForm = false"
    >
      <div class="card w-full max-w-md" style="border: 1px solid var(--border)">
        <div class="mb-4 flex items-center justify-between">
          <div class="text-[15px] font-semibold">Tambah Device</div>
          <button class="btn btn-ghost btn-xs btn-icon" type="button" @click="showAddForm = false">
            <Icon name="X" :size="14" />
          </button>
        </div>
        <form class="flex flex-col gap-3" @submit.prevent="submitAdd">
          <div>
            <label class="mb-1 block text-xs" style="color: var(--muted)">Slug (ID unik)</label>
            <input v-model="addForm.slug" class="input w-full" placeholder="mis. rb-main" required />
          </div>
          <div>
            <label class="mb-1 block text-xs" style="color: var(--muted)">Nama Tampilan</label>
            <input v-model="addForm.displayName" class="input w-full" placeholder="mis. Mikrotik HAP ac²" required />
          </div>
          <div>
            <label class="mb-1 block text-xs" style="color: var(--muted)">IP Address</label>
            <input v-model="addForm.address" class="input w-full font-mono" placeholder="192.168.88.1" required />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs" style="color: var(--muted)">Username</label>
              <input v-model="addForm.username" class="input w-full" placeholder="admin" required />
            </div>
            <div>
              <label class="mb-1 block text-xs" style="color: var(--muted)">Password</label>
              <input v-model="addForm.password" type="password" class="input w-full" required />
            </div>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="addForm.useTls" type="checkbox" />
            Gunakan TLS (API-SSL)
          </label>
          <div class="mt-2 flex justify-end gap-2">
            <button type="button" class="btn btn-ghost btn-sm" @click="showAddForm = false">Batal</button>
            <button type="submit" class="btn btn-primary btn-sm" :disabled="createMutation.isPending.value">
              Simpan
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Edit Device Modal -->
    <div
      v-if="showEditForm"
      class="fixed inset-0 z-50 flex items-center justify-center"
      style="background: rgba(0,0,0,0.6)"
      @click.self="showEditForm = false"
    >
      <div class="card w-full max-w-md" style="border: 1px solid var(--border)">
        <div class="mb-4 flex items-center justify-between">
          <div class="text-[15px] font-semibold">Edit Device</div>
          <button class="btn btn-ghost btn-xs btn-icon" type="button" @click="showEditForm = false">
            <Icon name="X" :size="14" />
          </button>
        </div>
        <form class="flex flex-col gap-3" @submit.prevent="submitEdit">
          <div>
            <label class="mb-1 block text-xs" style="color: var(--muted)">Nama Tampilan</label>
            <input v-model="editForm.displayName" class="input w-full" placeholder="mis. Mikrotik HAP ac²" required />
          </div>
          <div>
            <label class="mb-1 block text-xs" style="color: var(--muted)">IP Address</label>
            <input v-model="editForm.address" class="input w-full font-mono" placeholder="192.168.88.1" required />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-1 block text-xs" style="color: var(--muted)">Username</label>
              <input v-model="editForm.username" class="input w-full" placeholder="admin" required />
            </div>
            <div>
              <label class="mb-1 block text-xs" style="color: var(--muted)">Password (Kosongkan jika tetap)</label>
              <input v-model="editForm.password" type="password" class="input w-full" placeholder="••••••••" />
            </div>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="editForm.useTls" type="checkbox" />
            Gunakan TLS (API-SSL)
          </label>
          <div class="mt-2 flex justify-end gap-2">
            <button type="button" class="btn btn-ghost btn-sm" @click="showEditForm = false">Batal</button>
            <button type="submit" class="btn btn-primary btn-sm" :disabled="updateMutation.isPending.value">
              Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Confirm Delete Modal -->
    <ConfirmModal
      :open="showDeleteConfirm"
      title="Hapus Device"
      :message="`Apakah Anda yakin ingin menghapus device '${deletingDevice?.displayName || deletingDevice?.slug}'? Tindakan ini permanen.`"
      confirm-text="Hapus Permanen"
      cancel-text="Batal"
      variant="danger"
      @close="showDeleteConfirm = false"
      @confirm="submitDelete"
    />
  </div>
</template>
