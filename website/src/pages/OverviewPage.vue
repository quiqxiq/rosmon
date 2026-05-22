<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
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
import { fmtRp, fmtRpShort } from '@/utils/fmt'
import { DEVICES } from '@/fixtures/devices'
import { REVENUE_7D, TRAFFIC_24H } from '@/fixtures/activity'
import { SYSTEM_RESOURCE } from '@/fixtures/system'

const router = useRouter()
const { activeDeviceId } = useActiveDevice()
const dev = computed(() => DEVICES.find((d) => d.id === activeDeviceId.value) ?? DEVICES[0])

const range = ref<'today' | '7d' | '30d'>('today')
const salesView = ref<'rev' | 'tx'>('rev')
const trafficRange = ref<'24h' | '7d'>('24h')

// Live system resource sim
const cpu = ref(SYSTEM_RESOURCE.cpu)
const ram = ref(SYSTEM_RESOURCE.ram)
const disk = ref(SYSTEM_RESOURCE.disk)

const rxLive = useLiveSeries(30, TRAFFIC_24H.rx)
const txLive = useLiveSeries(30, TRAFFIC_24H.tx)

const tickId = window.setInterval(() => {
  cpu.value = Math.max(2, Math.min(98, cpu.value + (Math.random() - 0.5) * 6))
  ram.value = Math.max(2, Math.min(98, ram.value + (Math.random() - 0.5) * 4))
  disk.value = Math.max(2, Math.min(98, disk.value + (Math.random() - 0.5) * 2))
  rxLive.pushPoint(40 + Math.random() * 35)
  txLive.pushPoint(12 + Math.random() * 18)
}, 1500)
onBeforeUnmount(() => window.clearInterval(tickId))

const salesSeries = computed(() => [
  salesView.value === 'rev'
    ? { name: 'Voucher', data: REVENUE_7D.voucher, color: 'var(--accent-cyan)' }
    : { name: 'Transaksi', data: REVENUE_7D.transaksi, color: 'var(--accent-cyan)' },
])

function go(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="fade-in">
    <PageHeader
      title="Selamat datang kembali, Rendra"
    >
      <template #default>
        <div class="ph-sub">
          Ringkasan operasional
          <b style="color: var(--text-2); font-weight: 500">{{ dev.slug }}</b>
          ·
          {{ new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) }}
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
        <button class="btn btn-sm" type="button">
          <Icon name="Download" :size="13" />
          Export
        </button>
      </template>
    </PageHeader>

    <!-- KPI row -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <OverviewKpiCard
        label="Active Sessions"
        :value="dev.active"
        delta="+12 sejak 1 jam lalu"
        trend="up"
        icon="Activity"
        accent="cyan"
        :spark="[3, 5, 4, 6, 5, 7, 8, 6, 9, 11, 10, 13, 12, 15, 14, 16, 18, 17]"
        live
      />
      <OverviewKpiCard
        label="Hotspot Users"
        :value="dev.users"
        delta="+4 user baru hari ini"
        trend="up"
        icon="Users"
        accent="violet"
        :spark="[100, 120, 140, 160, 180, 210, 230, 260, 290, 310, 340, 360, 380, 400, 412]"
      />
      <OverviewKpiCard
        label="Revenue Hari Ini"
        :value="fmtRpShort(478000)"
        delta="+18.4% vs kemarin"
        trend="up"
        icon="Ticket"
        accent="lime"
        :spark="[5, 3, 4, 7, 9, 6, 8, 11, 9, 13, 12, 15, 18, 16, 21]"
      />
      <OverviewKpiCard
        label="Uptime Router"
        :value="dev.uptime"
        :delta="dev.version"
        trend="flat"
        icon="Power"
        accent="cyan"
      >
        <template #subValue>
          <StatusDot :status="dev.status" :show-label="false" />
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
              <span class="text-2xl font-semibold" style="letter-spacing: -0.02em">{{ fmtRp(2896000) }}</span>
              <Badge tone="lime">↑ 23.5% WoW</Badge>
            </div>
            <div class="mt-1 text-xs" style="color: var(--muted)">7 hari terakhir · 408 transaksi</div>
          </div>
          <Segmented
            v-model="salesView"
            :options="[
              { value: 'rev', label: 'Revenue' },
              { value: 'tx', label: 'Transaksi' },
            ]"
          />
        </div>
        <TrendChart :series="salesSeries" :x-labels="REVENUE_7D.labels" :height="210" />
      </div>

      <div class="card">
        <div class="mb-3 flex items-center justify-between">
          <div>
            <div
              class="text-xs font-medium uppercase"
              style="color: var(--muted); letter-spacing: 0.05em"
            >
              System Resource
            </div>
            <div class="mt-1 text-lg font-semibold">Sehat</div>
          </div>
          <LiveTag label="LIVE · 1s" />
        </div>
        <div class="grid grid-cols-3 gap-2.5">
          <SystemRingItem
            label="CPU"
            :value="Math.round(cpu)"
            color="var(--accent-cyan)"
            detail="MIPSBE 880MHz"
          />
          <SystemRingItem
            label="RAM"
            :value="Math.round(ram)"
            color="var(--accent-violet)"
            detail="159 / 256 MB"
          />
          <SystemRingItem
            label="Disk"
            :value="Math.round(disk)"
            color="var(--accent-lime)"
            detail="14 / 80 MB"
          />
        </div>
        <div
          class="mt-3.5 flex items-center gap-2.5 rounded-lg p-2.5"
          style="background: var(--bg-2)"
        >
          <Icon name="Zap" :size="14" :style="{ color: 'var(--accent-cyan)' }" />
          <div class="flex-1 text-[12.5px]">
            <div class="font-medium">Voltage / Temp</div>
            <div class="mt-0.5" style="color: var(--muted)">
              <span class="mono">{{ SYSTEM_RESOURCE.voltage }}V</span> ·
              <span class="mono">{{ SYSTEM_RESOURCE.temperature }} °C</span> ·
              <span class="mono">{{ SYSTEM_RESOURCE.powerW }}W</span>
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
              Traffic — ether1 (WAN)
            </div>
            <div class="mt-1.5 flex flex-wrap items-center gap-4">
              <span class="flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-sm" style="background: var(--accent-cyan)" />
                <span class="text-xs" style="color: var(--muted)">RX</span>
                <span class="mono text-sm font-semibold">{{ rxLive.data.value.at(-1)?.toFixed(1) ?? '0' }} Mbps</span>
              </span>
              <span class="flex items-center gap-1.5">
                <span class="h-2 w-2 rounded-sm" style="background: var(--accent-violet)" />
                <span class="text-xs" style="color: var(--muted)">TX</span>
                <span class="mono text-sm font-semibold">{{ txLive.data.value.at(-1)?.toFixed(1) ?? '0' }} Mbps</span>
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
          <button class="btn btn-ghost btn-xs" type="button" @click="go('/hotspot/sessions')">
            Lihat semua
          </button>
        </div>
        <ActivityFeed />
      </div>

      <div class="card">
        <div class="mb-3 flex items-center justify-between">
          <div class="text-[13px] font-semibold">Top Profile Hari Ini</div>
          <button class="btn btn-ghost btn-xs btn-icon" type="button">
            <Icon name="More" :size="14" />
          </button>
        </div>
        <TopProfilesList />
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
        @click="go('/hotspot/users')"
      />
      <QuickAction
        icon="Activity"
        title="Lihat Sessions"
        desc="Monitor real-time pemakaian"
        color="lime"
        @click="go('/hotspot/sessions')"
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
