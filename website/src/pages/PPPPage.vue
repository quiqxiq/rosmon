<script setup lang="ts">
import { computed, h, ref } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import Tabs from '@/components/ui/Tabs.vue'
import Badge from '@/components/ui/Badge.vue'
import Avatar from '@/components/ui/Avatar.vue'
import Card from '@/components/ui/Card.vue'
import DataTable from '@/components/ui/DataTable.vue'
import OverviewKpiCard from '@/components/overview/OverviewKpiCard.vue'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { usePPPSecretsQuery, usePPPActiveQuery, usePPPProfilesQuery } from '@/queries/ppp.queries'
import { useToast } from '@/composables/useToast'
import type { PPPSecret, PPPActive } from '@/types/ppp'

const toast = useToast()
const { activeDeviceId } = useActiveDevice()

type TabId = 'secret' | 'active' | 'profile' | 'inactive'
const tab = ref<TabId>('secret')

// Query Hooks
const { data: apiSecrets, refetch: refetchSecrets, isLoading: loadingSecrets } = usePPPSecretsQuery(activeDeviceId)
const { data: apiActive, refetch: refetchActive, isLoading: loadingActive } = usePPPActiveQuery(activeDeviceId)
const { data: apiProfiles, refetch: refetchProfiles, isLoading: loadingProfiles } = usePPPProfilesQuery(activeDeviceId)

const activeNames = computed(() => {
  return new Set((apiActive.value ?? []).map((s) => s.name))
})

const inactiveSecrets = computed(() => {
  const secrets = apiSecrets.value ?? []
  return secrets.filter((s) => !activeNames.value.has(s.name))
})

const tabs = computed(() => [
  { id: 'secret' as const, label: 'Secret', icon: 'Lock' as const, count: (apiSecrets.value ?? []).length },
  {
    id: 'active' as const,
    label: 'Active',
    icon: 'Activity' as const,
    count: (apiActive.value ?? []).length,
    live: true,
  },
  { id: 'profile' as const, label: 'Profile', icon: 'Wifi' as const, count: (apiProfiles.value ?? []).length },
  {
    id: 'inactive' as const,
    label: 'Inactive',
    icon: 'Power' as const,
    count: inactiveSecrets.value.length,
  },
])

const secretCols = computed<ColumnDef<PPPSecret>[]>(() => [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) =>
      h('div', null, [
        h('div', { class: 'mono text-[13px] font-medium' }, row.original.name),
        row.original.comment
          ? h('div', { class: 'text-[11px]', style: 'color: var(--muted)' }, row.original.comment)
          : null,
      ]),
  },
  {
    accessorKey: 'profile',
    header: 'Profile',
    cell: ({ row }) => h(Badge, { tone: 'cyan' }, () => row.original.profile),
  },
  {
    accessorKey: 'service',
    header: 'Service',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.service),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'remoteAddress',
    header: 'Remote Address',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.remoteAddress || '—'),
    meta: { mobileHidden: true },
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const isOnline = activeNames.value.has(row.original.name)
      if (row.original.disabled) return h(Badge, { tone: 'neutral' }, () => 'Disabled')
      return h(Badge, { tone: isOnline ? 'success' : 'neutral', dot: true }, () =>
        isOnline ? 'Online' : 'Offline',
      )
    },
  },
])

const activeCols = computed<ColumnDef<PPPActive>[]>(() => [
  {
    accessorKey: 'name',
    header: 'User',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2.5' }, [
        h(Avatar, { name: row.original.name, size: 28 }),
        h('span', { class: 'mono text-[13px] font-medium' }, row.original.name),
      ]),
  },
  {
    accessorKey: 'service',
    header: 'Service',
    cell: ({ row }) => h(Badge, { tone: 'cyan' }, () => row.original.service),
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.address || '—'),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'uptime',
    header: 'Uptime',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.uptime || '—'),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'encoding',
    header: 'Encoding',
    cell: ({ row }) => h('span', { class: 'text-xs mono', style: 'color: var(--muted)' }, row.original.encoding || '—'),
  },
])

function reload() {
  if (activeDeviceId.value) {
    refetchSecrets()
    refetchActive()
    refetchProfiles()
    toast.success('Data PPP disinkronkan!')
  }
}
</script>

<template>
  <div class="fade-in">
    <PageHeader title="PPP" subtitle="PPPoE secrets, active sessions, profiles & inactive">
      <template #right>
        <button class="btn btn-sm" type="button" @click="reload">
          <Icon name="Refresh" :size="13" />
          Reload
        </button>
      </template>
    </PageHeader>

    <div v-if="loadingSecrets || loadingActive || loadingProfiles" class="mb-4 flex items-center justify-center p-8">
      <div class="text-sm" style="color: var(--muted)">Loading PPP data...</div>
    </div>

    <div v-else>
      <Tabs v-model="tab" :tabs="tabs" class="mb-4" />

      <!-- Secret -->
      <div v-if="tab === 'secret'">
        <DataTable
          :columns="secretCols"
          :data="apiSecrets ?? []"
          :get-row-id="(s) => s.id"
          :page-size="10"
        >
          <template #toolbar>
            <span class="text-xs" style="color: var(--muted)">{{ (apiSecrets ?? []).length }} secrets</span>
          </template>
        </DataTable>
      </div>

      <!-- Active -->
      <div v-else-if="tab === 'active'">
        <div class="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewKpiCard
            label="Active Sessions"
            :value="(apiActive ?? []).length"
            delta="live"
            trend="flat"
            icon="Activity"
            accent="cyan"
            live
          />
        </div>
        <DataTable
          :columns="activeCols"
          :data="apiActive ?? []"
          :get-row-id="(s) => s.id"
          :page-size="10"
        />
      </div>

      <!-- Profile -->
      <div v-else-if="tab === 'profile'" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card v-for="p in apiProfiles ?? []" :key="p.id" accent="var(--accent-violet)">
          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div
                class="flex h-9 w-9 items-center justify-center rounded-lg"
                style="background: var(--accent-violet-soft); color: var(--accent-violet)"
              >
                <Icon name="Wifi" :size="16" />
              </div>
              <div>
                <div class="text-sm font-semibold">{{ p.name }}</div>
                <div class="mono text-[11px]" style="color: var(--muted)">{{ p.id }}</div>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div style="color: var(--muted)">Rate Limit</div>
              <div class="mono font-medium">{{ p.rateLimit || 'unlimited' }}</div>
            </div>
            <div>
              <div style="color: var(--muted)">Local Address</div>
              <div class="mono font-medium">{{ p.localAddress || '—' }}</div>
            </div>
            <div>
              <div style="color: var(--muted)">Remote Address</div>
              <div class="mono font-medium">{{ p.remoteAddress || '—' }}</div>
            </div>
            <div>
              <div style="color: var(--muted)">Session Timeout</div>
              <div class="mono font-medium">{{ p.sessionTimeout || '—' }}</div>
            </div>
            <div>
              <div style="color: var(--muted)">Only One</div>
              <div class="mono font-medium">{{ p.onlyOne || '—' }}</div>
            </div>
          </div>
        </Card>
      </div>

      <!-- Inactive -->
      <div v-else-if="tab === 'inactive'">
        <DataTable
          :columns="secretCols"
          :data="inactiveSecrets"
          :get-row-id="(s) => s.id"
          :page-size="10"
          empty-message="Tidak ada secret inactive"
        />
      </div>
    </div>
  </div>
</template>
