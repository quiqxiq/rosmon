<script setup lang="ts">
import { computed, h, ref } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import SearchInput from '@/components/ui/SearchInput.vue'
import Select from '@/components/ui/Select.vue'
import Badge from '@/components/ui/Badge.vue'
import DataTable from '@/components/ui/DataTable.vue'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { useHotspotBindingsQuery } from '@/queries/hotspot.queries'
import type { HotspotIpBinding } from '@/types/hotspot'

const { activeDeviceId } = useActiveDevice()

const search = ref('')
const filterType = ref<string>('all')

const { data: apiBindings, isLoading: loadingBindings } = useHotspotBindingsQuery(activeDeviceId)

const filtered = computed(() => {
  const bindings = apiBindings.value ?? []
  return bindings.filter((b) => {
    if (search.value) {
      const s = search.value.toLowerCase()
      if (
        !(
          (b.mac_address || '').toLowerCase().includes(s) ||
          (b.address || '').toLowerCase().includes(s) ||
          (b.server || '').toLowerCase().includes(s)
        )
      )
        return false
    }
    if (filterType.value !== 'all' && b.type !== filterType.value) return false
    return true
  })
})

const columns = computed<ColumnDef<HotspotIpBinding>[]>(() => [
  {
    accessorKey: 'mac_address',
    header: 'MAC Address',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.mac_address || '—'),
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.address || '—'),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'to_address',
    header: 'To Address',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.to_address || '—'),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'server',
    header: 'Server',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.server || 'all'),
    meta: { mobileHidden: true },
  },
  {
    id: 'type',
    header: 'Type',
    cell: ({ row }) => {
      const t = row.original.type
      const tone = t === 'bypassed' ? 'success' : t === 'blocked' ? 'danger' : 'neutral'
      return h(Badge, { tone }, () => t)
    },
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const b = row.original
      const tone = b.disabled ? 'neutral' : b.bypassed ? 'success' : 'warn'
      const label = b.disabled ? 'Disabled' : b.bypassed ? 'Bypassed' : 'Enabled'
      return h(Badge, { tone, dot: true }, () => label)
    },
  },
])
</script>

<template>
  <div>
    <div v-if="loadingBindings" class="mb-4 flex items-center justify-center p-8">
      <div class="text-sm" style="color: var(--muted)">Loading IP bindings...</div>
    </div>

    <DataTable
      v-else
      :columns="columns"
      :data="filtered"
      :get-row-id="(b) => b.id"
      :global-filter="search"
      :page-size="10"
      empty-message="Tidak ada IP binding"
      @update:global-filter="(v) => (search = v)"
    >
      <template #toolbar>
        <SearchInput v-model="search" placeholder="Cari MAC, address, server..." />
        <Select
          v-model="filterType"
          sm
          :options="[
            { value: 'all', label: 'Semua tipe' },
            { value: 'regular', label: 'Regular' },
            { value: 'bypassed', label: 'Bypassed' },
            { value: 'blocked', label: 'Blocked' },
          ]"
        />
      </template>
    </DataTable>
  </div>
</template>
