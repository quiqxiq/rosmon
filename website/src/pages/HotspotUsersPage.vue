<script setup lang="ts">
import { computed, h, ref } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import PageHeader from '@/components/ui/PageHeader.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import Icon from '@/components/ui/Icon.vue'
import Badge from '@/components/ui/Badge.vue'
import Avatar from '@/components/ui/Avatar.vue'
import Select from '@/components/ui/Select.vue'
import DataTable from '@/components/ui/DataTable.vue'
import SummaryChip from '@/components/hotspot/SummaryChip.vue'
import HotspotUserDrawer from '@/components/hotspot/HotspotUserDrawer.vue'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { fmtBytes, fmtDuration } from '@/utils/fmt'
import { HS_USERS, HS_PROFILES, type FixtureHotspotUser } from '@/fixtures/hotspot'

const { activeDeviceId } = useActiveDevice()

const users = ref<FixtureHotspotUser[]>([...HS_USERS])
const search = ref('')
const filterProfile = ref<string>('all')
const filterServer = ref<string>('all')
const filterStatus = ref<string>('all')
const drawerOpen = ref(false)
const editingUser = ref<Partial<FixtureHotspotUser> | null>(null)
const selectedIds = ref<string[]>([])

const filtered = computed(() => {
  return users.value.filter((u) => {
    if (search.value) {
      const s = search.value.toLowerCase()
      if (
        !(
          u.name.toLowerCase().includes(s) ||
          (u.mac || '').toLowerCase().includes(s) ||
          u.profile.toLowerCase().includes(s)
        )
      )
        return false
    }
    if (filterProfile.value !== 'all' && u.profile !== filterProfile.value) return false
    if (filterServer.value !== 'all' && u.server !== filterServer.value) return false
    if (filterStatus.value === 'active' && !u.isActive) return false
    if (filterStatus.value === 'inactive' && u.isActive) return false
    if (filterStatus.value === 'disabled' && !u.disabled) return false
    return true
  })
})

const summary = computed(() => ({
  total: users.value.length,
  active: users.value.filter((u) => u.isActive).length,
  disabled: users.value.filter((u) => u.disabled).length,
  expiring: users.value.filter((u) => u.expiry < Date.now() + 86400000 && u.expiry > Date.now()).length,
  expired: users.value.filter((u) => u.expiry < Date.now()).length,
}))

const columns = computed<ColumnDef<FixtureHotspotUser>[]>(() => [
  {
    accessorKey: 'name',
    header: 'User',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2.5' }, [
        h(Avatar, { name: row.original.name, size: 28 }),
        h('div', null, [
          h('div', { class: 'text-[13px] font-medium' }, row.original.name),
          h('div', { class: 'mono text-[11px]', style: 'color: var(--muted)' }, row.original.mac || '—'),
        ]),
      ]),
  },
  {
    accessorKey: 'profile',
    header: 'Profile',
    cell: ({ row }) => h(Badge, { tone: 'cyan' }, () => row.original.profile),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'server',
    header: 'Server',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.server),
    meta: { mobileHidden: true },
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const u = row.original
      if (u.disabled) return h(Badge, { tone: 'neutral' }, () => 'Disabled')
      return h(
        Badge,
        { tone: u.isActive ? 'success' : 'neutral', dot: true },
        () => (u.isActive ? 'Online' : 'Offline'),
      )
    },
  },
  {
    accessorKey: 'uptime',
    header: 'Uptime',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, fmtDuration(row.original.uptime)),
    meta: { mobileHidden: true },
  },
  {
    id: 'usage',
    header: 'Pemakaian',
    cell: ({ row }) => {
      const u = row.original
      const total = u.bytesIn + u.bytesOut
      const pct = Math.min(100, (total / 10e9) * 100)
      return h('div', { class: 'flex min-w-[140px] flex-col gap-1' }, [
        h('div', { class: 'mono text-[11px]', style: 'color: var(--muted)' }, [
          `↓ ${fmtBytes(u.bytesIn)} · ↑ ${fmtBytes(u.bytesOut)}`,
        ]),
        h('div', { class: 'bar' }, [h('i', { style: `width: ${pct}%` })]),
      ])
    },
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'expiry',
    header: 'Expiry',
    cell: ({ row }) => {
      const u = row.original
      const expired = u.expiry < Date.now()
      const soon = u.expiry > Date.now() && u.expiry < Date.now() + 86400000
      const tone = expired ? 'danger' : soon ? 'warn' : 'neutral'
      const text = new Date(u.expiry).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
      return h(Badge, { tone }, () => text)
    },
    meta: { mobileHidden: true },
  },
  {
    id: '__actions',
    header: '',
    enableSorting: false,
    cell: ({ row }) =>
      h('div', { class: 'flex items-center justify-end gap-1' }, [
        h(
          'button',
          {
            class: 'btn btn-ghost btn-icon btn-xs',
            title: 'Edit',
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              editingUser.value = row.original
              drawerOpen.value = true
            },
          },
          [h(Icon, { name: 'Edit', size: 13 })],
        ),
        h(
          'button',
          {
            class: 'btn btn-ghost btn-icon btn-xs',
            title: 'More',
            onClick: (e: MouseEvent) => e.stopPropagation(),
          },
          [h(Icon, { name: 'More', size: 13 })],
        ),
      ]),
    meta: { align: 'right' },
  },
])

function deleteSelected() {
  users.value = users.value.filter((u) => !selectedIds.value.includes(u.id))
  selectedIds.value = []
}

function openCreate() {
  editingUser.value = {}
  drawerOpen.value = true
}

function onSave(u: Partial<FixtureHotspotUser>) {
  if (u.id) {
    users.value = users.value.map((x) => (x.id === u.id ? { ...x, ...u } : x))
  } else {
    users.value = [
      {
        id: `*N${Math.floor(Math.random() * 999)
          .toString(16)
          .toUpperCase()}`,
        name: (u.name as string) ?? 'new-user',
        profile: u.profile ?? HS_PROFILES[0].name,
        server: u.server ?? 'hotspot1',
        uptime: 0,
        bytesIn: 0,
        bytesOut: 0,
        mac: u.mac ?? null,
        expiry: Date.now() + 86400000,
        comment: u.comment ?? '',
        disabled: false,
        isActive: false,
      },
      ...users.value,
    ]
  }
  drawerOpen.value = false
}

function onDelete(id: string) {
  users.value = users.value.filter((u) => u.id !== id)
  drawerOpen.value = false
}
</script>

<template>
  <div class="fade-in">
    <PageHeader title="Hotspot Users">
      CRUD user hotspot pada
      <b style="color: var(--text-2); font-weight: 500">{{ activeDeviceId }}</b>
      · {{ filtered.length }} dari {{ users.length }} user
      <template #right>
        <button class="btn btn-sm" type="button">
          <Icon name="Download" :size="13" />
          Export CSV
        </button>
        <button class="btn btn-sm" type="button">
          <Icon name="Refresh" :size="13" />
          Reload
        </button>
        <button class="btn btn-primary btn-sm" type="button" @click="openCreate">
          <Icon name="Plus" :size="14" />
          Tambah User
        </button>
      </template>
    </PageHeader>

    <div class="mb-4 flex flex-wrap gap-2.5">
      <SummaryChip label="Total" :value="summary.total" accent="cyan" />
      <SummaryChip label="Aktif sekarang" :value="summary.active" accent="lime" />
      <SummaryChip label="Disabled" :value="summary.disabled" accent="violet" />
      <SummaryChip label="Akan expired (24j)" :value="summary.expiring" accent="warn" />
      <SummaryChip label="Sudah expired" :value="summary.expired" accent="danger" />
    </div>

    <DataTable
      :columns="columns"
      :data="filtered"
      :get-row-id="(u) => u.id"
      :global-filter="search"
      :page-size="9"
      enable-row-selection
      empty-message="Tidak ada user yang cocok dengan filter"
      @update:global-filter="(v) => (search = v)"
      @selection-change="(ids) => (selectedIds = ids)"
    >
      <template #toolbar>
        <SearchInput v-model="search" placeholder="Cari nama, MAC, profile..." />
        <Select
          v-model="filterProfile"
          sm
          :options="[
            { value: 'all', label: 'Semua profile' },
            ...HS_PROFILES.map((p) => ({ value: p.name, label: p.name })),
          ]"
        />
        <Select
          v-model="filterServer"
          sm
          :options="[
            { value: 'all', label: 'Semua server' },
            { value: 'hotspot1', label: 'hotspot1' },
            { value: 'hotspot2', label: 'hotspot2' },
          ]"
        />
        <Select
          v-model="filterStatus"
          sm
          :options="[
            { value: 'all', label: 'Semua status' },
            { value: 'active', label: 'Aktif' },
            { value: 'inactive', label: 'Tidak aktif' },
            { value: 'disabled', label: 'Disabled' },
          ]"
        />
      </template>

      <template #bulkBar="{ selectedCount, clear }">
        <span class="text-xs font-medium" style="color: var(--accent-cyan)">
          {{ selectedCount }} dipilih
        </span>
        <div class="flex items-center gap-2">
          <button class="btn btn-xs btn-ghost" type="button" @click="clear">Batal</button>
          <button class="btn btn-xs btn-danger" type="button" @click="deleteSelected">
            <Icon name="Trash" :size="11" />
            Hapus
          </button>
        </div>
      </template>
    </DataTable>

    <HotspotUserDrawer
      :open="drawerOpen"
      :user="editingUser"
      @close="drawerOpen = false"
      @save="onSave"
      @delete="onDelete"
    />
  </div>
</template>
