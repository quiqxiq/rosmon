<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/ui/PageHeader.vue'
import Segmented from '@/components/ui/Segmented.vue'
import Icon from '@/components/ui/Icon.vue'
import Badge from '@/components/ui/Badge.vue'
import StatusDot from '@/components/ui/StatusDot.vue'
import LiveTag from '@/components/ui/LiveTag.vue'
import TrendChart from '@/components/ui/charts/TrendChart.vue'
import LiveChart from '@/components/ui/charts/LiveChart.vue'
import OverviewKpiCard from '@/components/overview/OverviewKpiCard.vue'
import SystemRingItem from '@/components/overview/SystemRingItem.vue'
import ActivityFeed from '@/components/overview/ActivityFeed.vue'
import QuickAction from '@/components/overview/QuickAction.vue'
import TopProfilesList from '@/components/overview/TopProfilesList.vue'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { useLiveSeries } from '@/composables/useLiveSeries'
import { useSSE } from '@/composables/useSSE'
import { useAuthStore } from '@/stores/auth'
import { useDeviceQuery } from '@/queries/devices.queries'
import { useHotspotUsersQuery, useHotspotActiveQuery } from '@/queries/hotspot.queries'
import { useSalesQuery } from '@/queries/reports.queries'
import { buildStreamUrl } from '@/services/stream'
import { fmtRp, fmtRpShort } from '@/utils/fmt'
import type { ResourceStreamEvent } from '@/types/stream'

const router = useRouter()
const authStore = useAuthStore()
const { activeDeviceId } = useActiveDevice()

// Fetch device info nyata
const { data: device } = useDeviceQuery(activeDeviceId.value ?? '')

// Fetch hotspot counts nyata
const { data: hotspotUsers } = useHotspotUsersQuery(activeDeviceId)
const { data: hotspotActive } = useHotspotActiveQuery(activeDeviceId)

// Hitung rentang 7 hari terakhir
const last7DaysRange = computed(() => {
  const to = new Date()
  const from = new Date()
  from.setDate(to.getDate() - 6)
  const formatDate = (d: Date) => d.toISOString().split('T')[0]
  return {
    from: formatDate(from),
    to: formatDate(to),
  }
})

// Query real sales
const { data: salesList } = useSalesQuery(
  activeDeviceId,
  computed(() => last7DaysRange.value.from),
  computed(() => last7DaysRange.value.to),
)

// Dynamic weekly trend data
const computedSales7D = computed(() => {
  const list = salesList.value ?? []
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
  
  const result: Record<string, { label: string; rev: number; count: number }> = {}
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const dayLabel = days[d.getDay()]
    result[dateStr] = { label: dayLabel, rev: 0, count: 0 }
  }
  
  list.forEach((s) => {
    if (!s.soldAt) return
    const datePart = s.soldAt.split('T')[0].split(' ')[0]
    if (result[datePart]) {
      result[datePart].rev += s.price
      result[datePart].count++
    }
  })
  
  const entries = Object.values(result)
  return {
    labels: entries.map((e) => e.label),
    voucher: entries.map((e) => e.rev),
    transaksi: entries.map((e) => e.count),
  }
})

// Today's revenue dynamic calculation
const todayRevenue = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return (salesList.value ?? [])
    .filter((s) => s.soldAt && s.soldAt.startsWith(today))
    .reduce((a, s) => a + s.price, 0)
})

// Yesterday's revenue dynamic calculation
const yesterdayRevenue = computed(() => {
  const yest = new Date()
  yest.setDate(yest.getDate() - 1)
  const yestStr = yest.toISOString().split('T')[0]
  return (salesList.value ?? [])
    .filter((s) => s.soldAt && s.soldAt.startsWith(yestStr))
    .reduce((a, s) => a + s.price, 0)
})

const revenueDeltaText = computed(() => {
  const today = todayRevenue.value
  const yest = yesterdayRevenue.value
  if (yest === 0) {
    return today > 0 ? '+100% vs kemarin' : 'Sama dengan kemarin'
  }
  const diff = ((today - yest) / yest) * 100
  const sign = diff >= 0 ? '+' : ''
  return `${sign}${diff.toFixed(1)}% vs kemarin`
})

const revenueTrend = computed(() => {
  const today = todayRevenue.value
  const yest = yesterdayRevenue.value
  return today > yest ? 'up' : today < yest ? 'down' : 'flat'
})

const total7DRevenue = computed(() => (salesList.value ?? []).reduce((a, s) => a + s.price, 0))
const total7DCount = computed(() => (salesList.value ?? []).length)

// SSE: system resource stream (live)
const resourceUrl = computed(() =>
  activeDeviceId.value ? buildStreamUrl(activeDeviceId.value, 'system/resource') : null,
)
const { parsed: resourceEvent } = useSSE<ResourceStreamEvent>(resourceUrl, ['message'])

// Resource values
const cpu = ref(0)
const ram = ref(0)
const cpuFreq = ref<number | null>(null)
const ramTotalMB = ref(0)
const ramUsedMB = ref(0)
const boardName = ref('')
const version = ref('')
const uptime = ref('—')

watch(resourceEvent, (ev) => {
  if (!ev?.resource) return
  const r = ev.resource
  cpu.value = r.cpuLoad ?? 0
  const total = r.totalMemory ?? 0
  const free = r.freeMemory ?? 0
  const used = total - free
  ramTotalMB.value = Math.round(total / 1024 / 1024)
  ramUsedMB.value = Math.round(used / 1024 / 1024)
  ram.value = total > 0 ? Math.round((used / total) * 100) : 0
  cpuFreq.value = r.cpuFrequency ?? null
  boardName.value = r.boardName ?? ''
  version.value = r.version ?? ''
  uptime.value = r.uptime ?? '—'
})

// SSE: traffic stream
const trafficUrl = computed(() =>
  activeDeviceId.value ? buildStreamUrl(activeDeviceId.value, 'network/interfaces/stats') : null,
)

const rxLive = useLiveSeries(30)
const txLive = useLiveSeries(30)

const { parsed: trafficEvent } = useSSE(trafficUrl, ['message'])
watch(trafficEvent, (ev: any) => {
  if (!ev?.interfaces) return
  const ifaces = ev.interfaces as Array<{ rxBytes: number; txBytes: number }>
  const totalRx = ifaces.reduce((s, i) => s + (i.rxBytes ?? 0), 0)
  const totalTx = ifaces.reduce((s, i) => s + (i.txBytes ?? 0), 0)
  rxLive.pushPoint(totalRx / 1024 / 1024)
  txLive.pushPoint(totalTx / 1024 / 1024)
})

// Derived computed
const range = ref<'today' | '7d' | '30d'>('7d')
const salesView = ref<'rev' | 'tx'>('rev')
const trafficRange = ref<'24h' | '7d'>('24h')

const greeting = computed(() => {
  const name = authStore.user?.username ?? 'Admin'
  return `Selamat datang kembali, ${name}`
})

const deviceSlug = computed(() => device.value?.displayName || device.value?.slug || activeDeviceId.value || '—')
const deviceStatus = computed(() => {
  const s = device.value?.status
  if (!s) return 'offline' as const
  return s === 'connected' ? 'online' : s === 'error' ? 'danger' : s === 'connecting' ? 'warn' : ('offline' as const)
})

const salesSeries = computed(() => [
  salesView.value === 'rev'
    ? { name: 'Pendapatan', data: computedSales7D.value.voucher, color: 'var(--accent-cyan)' }
    : { name: 'Transaksi', data: computedSales7D.value.transaksi, color: 'var(--accent-cyan)' },
])

const healthLabel = computed(() => {
  if (cpu.value > 85 || ram.value > 85) return 'Beban Tinggi'
  if (cpu.value > 60 || ram.value > 60) return 'Beban Sedang'
  return cpu.value === 0 && ram.value === 0 ? 'Mencari Router...' : 'Sehat'
})

function go(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="fade-in">
    <PageHeader :title="greeting">
      <template #default>
        <div class="ph-sub">
          Ringkasan operasional
          <b style="color: var(--text-2); font-weight: 500">{{ deviceSlug }}</b>
          ·
          {{
            new Date().toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          }}
        </div>
      </template>
      <template #right>
        <Segmented
          v-model="range"
          :options="[
            { value: 'today', label: 'Hari ini' },
            { value: '7d', label: '7 hari' },
            { value: '30d', label: '30 hari' },
          ]"
        />
        <button class="btn btn-sm" type="button" @click="go('/reports')">
          <Icon name="Download" :size="13" />
          Laporan
        </button>
      </template>
    </PageHeader>

    <!-- Warning kalau belum pilih device -->
    <div
      v-if="!activeDeviceId"
      class="mb-4 flex items-center gap-3 rounded-lg px-4 py-3 text-sm"
      style="background: var(--warn-soft); border: 1px solid var(--warn); color: var(--warn)"
    >
      <Icon name="AlertCircle" :size="15" />
      Belum ada device yang dipilih. Pilih device di halaman
      <button class="underline" type="button" @click="go('/devices')">Devices</button>.
    </div>

    <!-- KPI row -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <OverviewKpiCard
        label="Active Sessions"
        :value="hotspotActive?.length ?? 0"
        delta="Sesi hotspot aktif"
        trend="up"
        icon="Activity"
        accent="cyan"
        :spark="[3, 5, 4, 6, 5, 7, 8, 6, 9, 11, 10, 13, 12, 15, 14, 16, 18, 17]"
        live
      />
      <OverviewKpiCard
        label="Hotspot Users"
        :value="hotspotUsers?.length ?? 0"
        delta="Total user terdaftar"
        trend="up"
        icon="Users"
        accent="violet"
        :spark="[100, 120, 140, 160, 180, 210, 230, 260, 290, 310, 340, 360, 380, 400, 412]"
      />
      <OverviewKpiCard
        label="Revenue Hari Ini"
        :value="fmtRpShort(todayRevenue)"
        :delta="revenueDeltaText"
        :trend="revenueTrend"
        icon="Ticket"
        accent="lime"
        :spark="[5, 3, 4, 7, 9, 6, 8, 11, 9, 13, 12, 15, 18, 16, 21]"
      />
      <OverviewKpiCard
        label="Uptime Router"
        :value="uptime"
        :delta="version || 'Hubungkan Router'"
        trend="flat"
        icon="Power"
        accent="cyan"
      >
        <template #subValue>
          <StatusDot :status="deviceStatus" :show-label="false" />
        </template>
      </OverviewKpiCard>
    </div>

    <!-- Sales + System Resource -->
    <div class="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
      <div class="card">
        <div class="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div
              class="text-xs font-medium uppercase"
              style="color: var(--muted); letter-spacing: 0.05em"
            >
              Penjualan Voucher
            </div>
            <div class="mt-1 flex flex-wrap items-baseline gap-2.5">
              <span class="text-2xl font-semibold" style="letter-spacing: -0.02em">{{
                fmtRp(total7DRevenue)
              }}</span>
            </div>
            <div class="mt-1 text-xs" style="color: var(--muted)">
              7 hari terakhir · {{ total7DCount }} transaksi
            </div>
          </div>
          <Segmented
            v-model="salesView"
            :options="[
              { value: 'rev', label: 'Revenue' },
              { value: 'tx', label: 'Transaksi' },
            ]"
          />
        </div>
        <TrendChart :series="salesSeries" :x-labels="computedSales7D.labels" :height="210" />
      </div>

      <!-- System Resource — Live via SSE -->
      <div class="card">
        <div class="mb-3 flex items-center justify-between">
          <div>
            <div
              class="text-xs font-medium uppercase"
              style="color: var(--muted); letter-spacing: 0.05em"
            >
              System Resource
            </div>
            <div class="mt-1 text-lg font-semibold">{{ healthLabel }}</div>
          </div>
          <LiveTag :label="activeDeviceId ? 'LIVE · SSE' : 'No Device'" />
        </div>
        <div class="grid grid-cols-3 gap-2.5">
          <SystemRingItem
            label="CPU"
            :value="Math.round(cpu)"
            color="var(--accent-cyan)"
            :detail="cpuFreq ? `${cpuFreq} MHz` : boardName"
          />
          <SystemRingItem
            label="RAM"
            :value="Math.round(ram)"
            color="var(--accent-violet)"
            :detail="ramTotalMB ? `${ramUsedMB} / ${ramTotalMB} MB` : '—'"
          />
          <SystemRingItem
            label="Disk"
            :value="0"
            color="var(--accent-lime)"
            detail="—"
          />
        </div>
        <div
          class="mt-3.5 flex items-center gap-2.5 rounded-lg p-2.5"
          style="background: var(--bg-2)"
        >
          <Icon name="Zap" :size="14" :style="{ color: 'var(--accent-cyan)' }" />
          <div class="flex-1 text-[12.5px]">
            <div class="font-medium">Router Info</div>
            <div class="mt-0.5 mono" style="color: var(--muted)">
              {{ version || '—' }} · {{ boardName || '—' }}
            </div>
          </div>
          <Badge tone="success">Normal</Badge>
        </div>
      </div>
    </div>

    <!-- Traffic / Activity / Top profiles -->
    <div class="mt-4 grid gap-4 lg:grid-cols-3">
      <div class="card">
        <div class="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <div
              class="text-xs font-medium uppercase"
              style="color: var(--muted); letter-spacing: 0.05em"
            >
              Traffic — WAN (Live)
            </div>
            <div class="mt-1.5 flex flex-wrap items-center gap-4">
              <span class="flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-sm" style="background: var(--accent-cyan)" />
                <span class="text-xs" style="color: var(--muted)">RX</span>
                <span class="mono text-sm font-semibold"
                  >{{ rxLive.data.value.at(-1)?.toFixed(1) ?? '0' }} Mbps</span
                >
              </span>
              <span class="flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-sm" style="background: var(--accent-violet)" />
                <span class="text-xs" style="color: var(--muted)">TX</span>
                <span class="mono text-sm font-semibold"
                  >{{ txLive.data.value.at(-1)?.toFixed(1) ?? '0' }} Mbps</span
                >
              </span>
            </div>
          </div>
          <Segmented v-model="trafficRange" :options="['24h', '7d']" />
        </div>
        <LiveChart
          :series="[
            { name: 'RX', data: rxLive.data.value, color: 'var(--accent-cyan)' },
            { name: 'TX', data: txLive.data.value, color: 'var(--accent-violet)' },
          ]"
          :window-size="30"
          :height="180"
          :format-y="(v) => `${Math.round(v)}M`"
        />
      </div>

      <div class="card flex flex-col">
        <div class="mb-2 flex items-center justify-between">
          <div class="text-[13px] font-semibold">Aktivitas Terkini</div>
          <button class="btn btn-ghost btn-xs" type="button" @click="go('/hotspot')">
            Lihat semua
          </button>
        </div>
        <ActivityFeed :sales="salesList" :active="hotspotActive" />
      </div>

      <div class="card">
        <div class="mb-3 flex items-center justify-between">
          <div class="text-[13px] font-semibold">Top Profile Hari Ini</div>
          <button class="btn btn-ghost btn-xs btn-icon" type="button">
            <Icon name="More" :size="14" />
          </button>
        </div>
        <TopProfilesList :sales="salesList" />
      </div>
    </div>

    <!-- Quick actions -->
    <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <QuickAction
        icon="Ticket"
        title="Generate Voucher"
        desc="Batch baru dengan profile pilihan"
        color="cyan"
        @click="go('/hotspot/voucher')"
      />
      <QuickAction
        icon="Plus"
        title="Tambah User"
        desc="Manual create hotspot user"
        color="violet"
        @click="go('/hotspot')"
      />
      <QuickAction
        icon="Activity"
        title="Lihat Sessions"
        desc="Monitor real-time pemakaian"
        color="lime"
        @click="go('/hotspot')"
      />
      <QuickAction
        icon="Report"
        title="Laporan Penjualan"
        desc="Export bulanan ke CSV"
        color="cyan"
        @click="go('/reports')"
      />
    </div>
  </div>
</template>
