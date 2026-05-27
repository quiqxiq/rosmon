<script setup lang="ts">
import { computed, h, onBeforeUnmount, ref } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import Icon from '@/components/ui/Icon.vue'
import Avatar from '@/components/ui/Avatar.vue'
import LiveTag from '@/components/ui/LiveTag.vue'
import Segmented from '@/components/ui/Segmented.vue'
import DataTable from '@/components/ui/DataTable.vue'
import LiveChart from '@/components/ui/charts/LiveChart.vue'
import OverviewKpiCard from '@/components/overview/OverviewKpiCard.vue'
import EventStreamCard from '@/components/session/EventStreamCard.vue'
import SessionDetailCard from '@/components/session/SessionDetailCard.vue'
import { useLiveSeries } from '@/composables/useLiveSeries'
import { useToast } from '@/composables/useToast'
import { fmtBytes, fmtRate } from '@/utils/fmt'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { useHotspotActiveQuery } from '@/queries/hotspot.queries'
import { hotspotSessionsService } from '@/services/hotspot-sessions'
import type { HotspotSession } from '@/types/hotspot'

const toast = useToast()
const { activeDeviceId } = useActiveDevice()

const paused = ref(false)
const window_ = ref<'30s' | '1m' | '5m'>('1m')
const filter = ref<'all' | 'high' | 'idle' | 'mobile'>('all')

const { data: apiActive, refetch: refetchActive, isLoading: loadingActive } = useHotspotActiveQuery(activeDeviceId)

const selected = ref<HotspotSession | null>(null)

// Hitung total throughput secara dinamis jika ada data real-time, atau beri fallback
const totalRX = computed(() => (apiActive.value ?? []).reduce((a, s) => a + s.bytes_in * 0.05, 0)) // dummy throughput dari bytes
const totalTX = computed(() => (apiActive.value ?? []).reduce((a, s) => a + s.bytes_out * 0.05, 0))

const rxSeries = useLiveSeries(60)
const txSeries = useLiveSeries(60)

const tickId = window.setInterval(() => {
  if (paused.value) return
  if (apiActive.value) {
    refetchActive()
  }
  rxSeries.pushPoint(totalRX.value / 1e6)
  txSeries.pushPoint(totalTX.value / 1e6)
}, 2000)
onBeforeUnmount(() => window.clearInterval(tickId))

const filtered = computed(() => {
  const list = apiActive.value ?? []
  if (filter.value === 'all') return list
  if (filter.value === 'high') return list.filter((s) => s.bytes_in > 100_000_000)
  if (filter.value === 'idle') return list.filter((s) => s.bytes_in < 1_000_000)
  if (filter.value === 'mobile') return list.filter((s) => s.mac_address?.startsWith('AC') || s.mac_address?.startsWith('BC'))
  return list
})

const columns = computed<ColumnDef<HotspotSession>[]>(() => [
  {
    accessorKey: 'user',
    header: 'User',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2.5' }, [
        h(Avatar, { name: row.original.user, size: 28 }),
        h('div', null, [
          h('div', { class: 'text-[13px] font-medium' }, row.original.user),
          h('span', { class: 'text-xs', style: 'color: var(--muted)' }, row.original.comment || '—'),
        ]),
      ]),
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ row }) =>
      h('div', { class: 'mono text-[12px]' }, [
        h('div', null, row.original.address || '—'),
        h('div', { style: 'color: var(--muted); font-size: 11px' }, row.original.mac_address || '—'),
      ]),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'uptime',
    header: 'Uptime',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.uptime || '—'),
    meta: { mobileHidden: true },
  },
  {
    id: 'throughput',
    header: 'Throughput',
    cell: ({ row }) => {
      const u = row.original
      return h('div', { class: 'mono text-[11px]' }, [
        h('div', { style: 'color: var(--accent-cyan)' }, `↓ ${fmtBytes(u.bytes_in)} total`),
        h('div', { style: 'color: var(--accent-violet)' }, `↑ ${fmtBytes(u.bytes_out)} total`),
      ])
    },
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
            title: 'Detail',
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              selected.value = row.original
            },
          },
          [h(Icon, { name: 'Eye', size: 13 })],
        ),
        h(
          'button',
          {
            class: 'btn btn-ghost btn-icon btn-xs',
            title: 'Kick',
            onClick: (e: MouseEvent) => {
              e.stopPropagation()
              kick(row.original.id, row.original.user)
            },
          },
          [h(Icon, { name: 'Power', size: 13, style: 'color: var(--danger)' })],
        ),
      ]),
    meta: { align: 'right' },
  },
])

async function kick(id: string, user: string) {
  if (!activeDeviceId.value) return
  try {
    await hotspotSessionsService.disconnectActive(activeDeviceId.value, id)
    if (selected.value?.id === id) selected.value = null
    toast.success(`Sesi aktif ${user} berhasil diputus (dikick)`)
    refetchActive()
  } catch (err) {
    toast.error(`Gagal memutus sesi: ${err instanceof Error ? err.message : String(err)}`)
  }
}
</script>

<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center gap-2">
      <LiveTag :on="!paused" :label="paused ? 'STREAM PAUSED' : 'STREAM AKTIF'" />
      <div class="flex-1" />
      <button class="btn btn-sm" type="button" @click="paused = !paused">
        <Icon :name="paused ? 'Activity' : 'Power'" :size="13" />
        {{ paused ? 'Resume' : 'Pause' }}
      </button>
    </div>

    <div v-if="loadingActive" class="mb-4 flex items-center justify-center p-8">
      <div class="text-sm" style="color: var(--muted)">Loading active sessions...</div>
    </div>

    <div v-else>
      <!-- Live stats -->
      <div class="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <OverviewKpiCard
          label="Active Sessions"
          :value="(apiActive ?? []).length"
          delta="updated 2s"
          trend="flat"
          icon="Activity"
          accent="cyan"
          live
        />
        <OverviewKpiCard
          label="Throughput RX"
          :value="fmtRate(totalRX)"
          delta="total"
          trend="up"
          icon="ArrowUpRight"
          accent="cyan"
          :spark="rxSeries.data.value.slice(-20)"
        />
        <OverviewKpiCard
          label="Throughput TX"
          :value="fmtRate(totalTX)"
          delta="total"
          trend="up"
          icon="ArrowUpRight"
          accent="violet"
          :spark="txSeries.data.value.slice(-20)"
        />
        <OverviewKpiCard
          label="Sesi Hari Ini"
          :value="(apiActive ?? []).length"
          delta="live count"
          trend="up"
          icon="Users"
          accent="lime"
        />
      </div>

      <!-- Main grid -->
      <div class="grid gap-4" :class="selected ? 'lg:grid-cols-[1fr_360px]' : 'grid-cols-1'">
        <div class="space-y-4">
          <!-- Live throughput chart -->
          <div class="card">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div class="text-[13px] font-semibold">Throughput Total (Mbps)</div>
              <Segmented v-model="window_" :options="['30s', '1m', '5m']" />
            </div>
            <LiveChart
              :series="[
                { name: 'RX', data: rxSeries.data.value, color: 'var(--accent-cyan)' },
                { name: 'TX', data: txSeries.data.value, color: 'var(--accent-violet)' },
              ]"
              :window-size="60"
              :height="200"
              :format-y="(v) => `${Math.round(v)} M`"
            />
          </div>

          <!-- Filter chips + Sessions table -->
          <DataTable
            :columns="columns"
            :data="filtered"
            :get-row-id="(s) => s.id"
            :page-size="10"
            clickable
            empty-message="Belum ada sesi aktif"
            @row-click="(s) => (selected = s)"
          >
            <template #toolbar>
              <Segmented
                v-model="filter"
                :options="[
                  { value: 'all', label: 'Semua' },
                  { value: 'high', label: 'High traffic' },
                  { value: 'idle', label: 'Idle' },
                  { value: 'mobile', label: 'Mobile' },
                ]"
              />
            </template>
          </DataTable>
        </div>

        <div v-if="selected" class="space-y-4">
          <SessionDetailCard :session="selected" @close="selected = null" @kick="kick(selected.id, selected.user)" />
          <EventStreamCard :paused="paused" />
        </div>
        <div v-else class="space-y-4">
          <EventStreamCard :paused="paused" />
        </div>
      </div>
    </div>
  </div>
</template>
