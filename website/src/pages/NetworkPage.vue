<script setup lang="ts">
import { computed, h, ref } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import Tabs from '@/components/ui/Tabs.vue'
import Badge from '@/components/ui/Badge.vue'
import Card from '@/components/ui/Card.vue'
import DataTable from '@/components/ui/DataTable.vue'
import OverviewKpiCard from '@/components/overview/OverviewKpiCard.vue'
import { useActiveDevice } from '@/composables/useActiveDevice'
import {
  useInterfacesQuery,
  useIPPoolsQuery,
  useDHCPLeasesQuery,
  useQueuesQuery,
  useARPQuery,
} from '@/queries/network.queries'
import { fmtBytes } from '@/utils/fmt'
import type { NetworkInterface, ARPEntry, DHCPLease, SimpleQueue } from '@/types/network'
import { useToast } from '@/composables/useToast'

const toast = useToast()
const { activeDeviceId } = useActiveDevice()

type TabId = 'interfaces' | 'pools' | 'arp' | 'dhcp' | 'queues'
const tab = ref<TabId>('interfaces')

// Queries
const { data: apiInterfaces, isLoading: loadingInterfaces, refetch: refetchInterfaces } = useInterfacesQuery(activeDeviceId)
const { data: apiIPPools, refetch: refetchIPPools } = useIPPoolsQuery(activeDeviceId)
const { data: apiARP, refetch: refetchARP } = useARPQuery(activeDeviceId)
const { data: apiDHCP, refetch: refetchDHCP } = useDHCPLeasesQuery(activeDeviceId)
const { data: apiQueues, refetch: refetchQueues } = useQueuesQuery(activeDeviceId)

const tabs = computed(() => [
  {
    id: 'interfaces' as const,
    label: 'Interfaces',
    icon: 'Network' as const,
    count: (apiInterfaces.value ?? []).length,
  },
  { id: 'pools' as const, label: 'IP Pools', icon: 'Globe' as const, count: (apiIPPools.value ?? []).length },
  { id: 'arp' as const, label: 'ARP', icon: 'Activity' as const, count: (apiARP.value ?? []).length },
  { id: 'dhcp' as const, label: 'DHCP', icon: 'Server' as const, count: (apiDHCP.value ?? []).length },
  { id: 'queues' as const, label: 'Queues', icon: 'Boot' as const, count: (apiQueues.value ?? []).length },
])

const ifaceCols = computed<ColumnDef<NetworkInterface>[]>(() => [
  {
    accessorKey: 'name',
    header: 'Interface',
    cell: ({ row }) =>
      h('div', null, [
        h('div', { class: 'mono text-[13px] font-medium' }, row.original.name),
      ]),
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => h(Badge, { tone: 'cyan' }, () => row.original.type),
  },
  {
    accessorKey: 'macAddress',
    header: 'MAC',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'mono text-[11px]', style: 'color: var(--muted)' },
        row.original.macAddress || '—',
      ),
    meta: { mobileHidden: true },
  },
  {
    id: 'total',
    header: 'Total Traffic (RX/TX)',
    cell: ({ row }) => {
      const rx = row.original.rxBytes ?? 0
      const tx = row.original.txBytes ?? 0
      return h(
        'span',
        { class: 'mono text-[12px]' },
        `${fmtBytes(rx)} / ${fmtBytes(tx)}`,
      )
    },
    meta: { mobileHidden: true },
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      if (row.original.disabled) return h(Badge, { tone: 'neutral' }, () => 'Disabled')
      if (!row.original.running) return h(Badge, { tone: 'warn' }, () => 'No link')
      return h(Badge, { tone: 'success', dot: true }, () => 'Running')
    },
  },
])

const arpCols = computed<ColumnDef<ARPEntry>[]>(() => [
  {
    accessorKey: 'address',
    header: 'IP Address',
    cell: ({ row }) => h('span', { class: 'mono text-[13px]' }, row.original.address),
  },
  {
    accessorKey: 'macAddress',
    header: 'MAC Address',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.macAddress),
  },
  {
    accessorKey: 'interface',
    header: 'Interface',
    cell: ({ row }) => h(Badge, { tone: 'cyan' }, () => row.original.interface),
  },
  {
    accessorKey: 'dynamic',
    header: 'Type',
    cell: ({ row }) =>
      h(Badge, { tone: row.original.dynamic ? 'cyan' : 'neutral' }, () =>
        row.original.dynamic ? 'Dynamic' : 'Static',
      ),
    meta: { mobileHidden: true },
  },
])

const dhcpCols = computed<ColumnDef<DHCPLease>[]>(() => [
  {
    accessorKey: 'address',
    header: 'IP / Host',
    cell: ({ row }) =>
      h('div', null, [
        h('div', { class: 'mono text-[13px]' }, row.original.address),
        h('div', { class: 'text-[11px]', style: 'color: var(--muted)' }, row.original.hostName || '—'),
      ]),
  },
  {
    accessorKey: 'macAddress',
    header: 'MAC',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.macAddress),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'server',
    header: 'DHCP Server',
    cell: ({ row }) => h(Badge, { tone: 'cyan' }, () => row.original.server || 'all'),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) =>
      h(
        Badge,
        { tone: row.original.status === 'bound' ? 'success' : 'warn', dot: true },
        () => row.original.status,
      ),
  },
])

const queueCols = computed<ColumnDef<SimpleQueue>[]>(() => [
  {
    accessorKey: 'name',
    header: 'Queue',
    cell: ({ row }) => h('span', { class: 'mono text-[13px] font-medium' }, row.original.name),
  },
  {
    accessorKey: 'target',
    header: 'Target',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.target),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'maxLimit',
    header: 'Max Limit',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.maxLimit || 'unlimited'),
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) =>
      row.original.disabled
        ? h(Badge, { tone: 'neutral' }, () => 'Disabled')
        : h(Badge, { tone: 'success', dot: true }, () => 'Active'),
  },
])

const runningCount = computed(() => (apiInterfaces.value ?? []).filter((i) => i.running).length)
const dhcpBound = computed(() => (apiDHCP.value ?? []).filter((l) => l.status === 'bound').length)
const arpDynamic = computed(() => (apiARP.value ?? []).filter((a) => a.dynamic).length)

function reload() {
  if (activeDeviceId.value) {
    refetchInterfaces()
    refetchIPPools()
    refetchARP()
    refetchDHCP()
    refetchQueues()
    toast.success('Data Network berhasil direfresh')
  }
}
</script>

<template>
  <div class="fade-in">
    <PageHeader title="Network" subtitle="Interfaces, IP pools, ARP, DHCP, queues">
      <template #right>
        <button class="btn btn-sm" type="button" @click="reload">
          <Icon name="Refresh" :size="13" />
          Reload
        </button>
      </template>
    </PageHeader>

    <div v-if="loadingInterfaces" class="mb-4 flex items-center justify-center p-8">
      <div class="text-sm" style="color: var(--muted)">Loading network interfaces...</div>
    </div>

    <div v-else>
      <!-- Health KPIs -->
      <div class="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewKpiCard
          label="Interfaces running"
          :value="`${runningCount} / ${(apiInterfaces ?? []).length}`"
          :delta="`${(apiInterfaces ?? []).length - runningCount} idle`"
          trend="flat"
          icon="Network"
          accent="cyan"
        />
        <OverviewKpiCard
          label="DHCP Leases"
          :value="(apiDHCP ?? []).length"
          :delta="`${dhcpBound} bound`"
          trend="up"
          icon="Server"
          accent="violet"
        />
        <OverviewKpiCard
          label="ARP Entries"
          :value="(apiARP ?? []).length"
          :delta="`${arpDynamic} dynamic`"
          trend="flat"
          icon="Activity"
          accent="lime"
        />
        <OverviewKpiCard
          label="Simple Queues"
          :value="(apiQueues ?? []).length"
          delta="aktif"
          trend="flat"
          icon="Boot"
          accent="cyan"
        />
      </div>

      <Tabs v-model="tab" :tabs="tabs" class="mb-4" />

      <DataTable
        v-if="tab === 'interfaces'"
        :columns="ifaceCols"
        :data="apiInterfaces ?? []"
        :get-row-id="(i) => i.id"
        :page-size="10"
      />

      <div v-else-if="tab === 'pools'" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card v-for="p in apiIPPools ?? []" :key="p.id" accent="var(--accent-cyan)">
          <div class="mb-2 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div
                class="flex h-9 w-9 items-center justify-center rounded-lg"
                style="background: var(--accent-cyan-soft); color: var(--accent-cyan)"
              >
                <Icon name="Globe" :size="16" />
              </div>
              <div>
                <div class="text-sm font-semibold">{{ p.name }}</div>
                <div class="mono text-[11px]" style="color: var(--muted)">{{ p.ranges }}</div>
              </div>
            </div>
          </div>
          <div v-if="p.nextPool" class="mt-2 text-xs" style="color: var(--muted)">
            Next Pool: <span class="mono">{{ p.nextPool }}</span>
          </div>
        </Card>
        <div v-if="!(apiIPPools ?? []).length" class="card col-span-full p-8 text-center text-xs" style="color: var(--muted)">
          Tidak ada IP pool terkonfigurasi.
        </div>
      </div>

      <DataTable
        v-else-if="tab === 'arp'"
        :columns="arpCols"
        :data="apiARP ?? []"
        :get-row-id="(a) => a.id"
        :page-size="10"
      />
      <DataTable
        v-else-if="tab === 'dhcp'"
        :columns="dhcpCols"
        :data="apiDHCP ?? []"
        :get-row-id="(l) => l.id"
        :page-size="10"
      />
      <DataTable
        v-else-if="tab === 'queues'"
        :columns="queueCols"
        :data="apiQueues ?? []"
        :get-row-id="(q) => q.id"
        :page-size="10"
      />
    </div>
  </div>
</template>
