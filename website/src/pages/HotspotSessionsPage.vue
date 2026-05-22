<script setup lang="ts">
import { computed, h, onBeforeUnmount, ref } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import Badge from '@/components/ui/Badge.vue'
import Avatar from '@/components/ui/Avatar.vue'
import LiveTag from '@/components/ui/LiveTag.vue'
import Segmented from '@/components/ui/Segmented.vue'
import Spark from '@/components/ui/Spark.vue'
import DataTable from '@/components/ui/DataTable.vue'
import LiveChart from '@/components/ui/charts/LiveChart.vue'
import OverviewKpiCard from '@/components/overview/OverviewKpiCard.vue'
import EventStreamCard from '@/components/session/EventStreamCard.vue'
import SessionDetailCard from '@/components/session/SessionDetailCard.vue'
import { useLiveSeries } from '@/composables/useLiveSeries'
import { fmtBytes, fmtDuration, fmtRate } from '@/utils/fmt'
import { HS_ACTIVE, type FixtureHotspotActive } from '@/fixtures/hotspot'

const paused = ref(false)
const window_ = ref<'30s' | '1m' | '5m'>('1m')
const filter = ref<'all' | 'high' | 'idle' | 'mobile'>('all')

const sessions = ref<FixtureHotspotActive[]>([...HS_ACTIVE])
const selected = ref<FixtureHotspotActive | null>(null)

const totalRX = computed(() => sessions.value.reduce((a, s) => a + s.rxRate, 0))
const totalTX = computed(() => sessions.value.reduce((a, s) => a + s.txRate, 0))

const rxSeries = useLiveSeries(60)
const txSeries = useLiveSeries(60)

const tickId = window.setInterval(() => {
  if (paused.value) return
  // Update each session rate
  sessions.value = sessions.value.map((s) => ({
    ...s,
    rxRate: Math.max(100_000, s.rxRate + (Math.random() - 0.5) * 500_000),
    txRate: Math.max(50_000, s.txRate + (Math.random() - 0.5) * 200_000),
    sparkIn: [...s.sparkIn.slice(1), Math.random()],
  }))
  rxSeries.pushPoint(totalRX.value / 1e6)
  txSeries.pushPoint(totalTX.value / 1e6)
}, 1200)
onBeforeUnmount(() => window.clearInterval(tickId))

const columns = computed<ColumnDef<FixtureHotspotActive>[]>(() => [
  {
    accessorKey: 'user',
    header: 'User',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2.5' }, [
        h(Avatar, { name: row.original.user, size: 28 }),
        h('div', null, [
          h('div', { class: 'text-[13px] font-medium' }, row.original.user),
          h(Badge, { tone: 'cyan' }, () => row.original.profile),
        ]),
      ]),
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ row }) =>
      h('div', { class: 'mono text-[12px]' }, [
        h('div', null, row.original.address),
        h('div', { style: 'color: var(--muted); font-size: 11px' }, row.original.mac),
      ]),
    meta: { mobileHidden: true },
  },
  {
    id: 'uptime',
    header: 'Uptime',
    cell: ({ row }) => {
      const sec = Math.floor((Date.now() - row.original.uptimeStart) / 1000)
      return h('span', { class: 'mono text-[12px]' }, fmtDuration(sec))
    },
    meta: { mobileHidden: true },
  },
  {
    id: 'throughput',
    header: 'Throughput',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2' }, [
        h(Spark, {
          data: row.original.sparkIn,
          kind: 'area',
          color: 'var(--accent-cyan)',
          width: 60,
          height: 20,
        }),
        h('div', { class: 'mono text-[11px]' }, [
          h(
            'div',
            { style: 'color: var(--accent-cyan)' },
            `↓ ${fmtRate(row.original.rxRate)}`,
          ),
          h(
            'div',
            { style: 'color: var(--accent-violet)' },
            `↑ ${fmtRate(row.original.txRate)}`,
          ),
        ]),
      ]),
  },
  {
    id: 'bytes',
    header: 'Bytes',
    cell: ({ row }) =>
      h('span', { class: 'mono text-[12px]' }, fmtBytes(row.original.bytesIn + row.original.bytesOut)),
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
            onClick: (e: MouseEvent) => e.stopPropagation(),
          },
          [h(Icon, { name: 'Kick', size: 13, style: 'color: var(--danger)' })],
        ),
      ]),
    meta: { align: 'right' },
  },
])

function kick() {
  if (!selected.value) return
  sessions.value = sessions.value.filter((s) => s.id !== selected.value?.id)
  selected.value = null
}
</script>

<template>
  <div class="fade-in">
    <PageHeader title="Live Sessions" subtitle="Sesi hotspot aktif — update setiap detik">
      <template #right>
        <LiveTag :on="!paused" :label="paused ? 'STREAM PAUSED' : 'STREAM AKTIF'" />
        <button class="btn btn-sm" type="button" @click="paused = !paused">
          <Icon :name="paused ? 'Activity' : 'Power'" :size="13" />
          {{ paused ? 'Resume' : 'Pause' }}
        </button>
      </template>
    </PageHeader>

    <!-- Live stats -->
    <div class="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <OverviewKpiCard
        label="Active Sessions"
        :value="sessions.length"
        delta="updated 1s"
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
        label="Login hari ini"
        :value="42"
        delta="+3 jam terakhir"
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
          :data="sessions"
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
        <SessionDetailCard :session="selected" @close="selected = null" @kick="kick" />
        <EventStreamCard :paused="paused" />
      </div>
      <div v-else class="space-y-4">
        <EventStreamCard :paused="paused" />
      </div>
    </div>
  </div>
</template>
