<script setup lang="ts">
import { computed, h, ref } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import Badge from '@/components/ui/Badge.vue'
import Avatar from '@/components/ui/Avatar.vue'
import Segmented from '@/components/ui/Segmented.vue'
import Card from '@/components/ui/Card.vue'
import TrendChart from '@/components/ui/charts/TrendChart.vue'
import DataTable from '@/components/ui/DataTable.vue'
import OverviewKpiCard from '@/components/overview/OverviewKpiCard.vue'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { useSalesQuery, useSalesSummaryQuery } from '@/queries/reports.queries'
import { fmtRpShort, fmtRp } from '@/utils/fmt'
import type { VoucherSale } from '@/types/report'
import { useToast } from '@/composables/useToast'
import { reportsService } from '@/services/reports'
import { todayStamp } from '@/utils/export'

const toast = useToast()
const { activeDeviceId } = useActiveDevice()

const range = ref<'today' | '7d' | '30d' | '90d'>('30d')
const chartView = ref<'rev' | 'vol'>('rev')

// Hitung rentang waktu berdasarkan range ref
const dateRange = computed(() => {
  const to = new Date()
  const from = new Date()
  if (range.value === 'today') {
    from.setHours(0, 0, 0, 0)
  } else if (range.value === '7d') {
    from.setDate(to.getDate() - 7)
  } else if (range.value === '30d') {
    from.setDate(to.getDate() - 30)
  } else if (range.value === '90d') {
    from.setDate(to.getDate() - 90)
  }
  return {
    from: from.toISOString().split('T')[0],
    to: to.toISOString().split('T')[0],
  }
})

// Queries
const { data: apiSales, isLoading: loadingSales } = useSalesQuery(
  activeDeviceId,
  computed(() => dateRange.value.from),
  computed(() => dateRange.value.to),
)
const { data: apiSummary } = useSalesSummaryQuery(activeDeviceId)

const salesList = computed<VoucherSale[]>(() => apiSales.value ?? [])

const todayRevenue = computed(() => {
  const today = new Date().toISOString().split('T')[0]
  return salesList.value
    .filter((s) => s.soldAt.startsWith(today))
    .reduce((a, s) => a + s.price, 0)
})

const totalRevenue = computed(() => salesList.value.reduce((a, s) => a + s.price, 0))
const totalCount = computed(() => salesList.value.length)

// Hitung performa per profile secara dinamis
const topProfiles = computed(() => {
  const groups: Record<string, { count: number; total: number }> = {}
  salesList.value.forEach((s) => {
    if (!groups[s.profile]) {
      groups[s.profile] = { count: 0, total: 0 }
    }
    groups[s.profile].count++
    groups[s.profile].total += s.price
  })
  
  return Object.entries(groups)
    .map(([profile, g]) => ({
      profile,
      count: g.count,
      avg: Math.round(g.total / g.count),
      total: g.total,
      share: totalRevenue.value > 0 ? Math.round((g.total / totalRevenue.value) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
})

// Hitung performa per operator (kasir) secara dinamis
const operators = computed(() => {
  const ops: Record<string, { count: number; revenue: number }> = {}
  salesList.value.forEach((s) => {
    const name = s.cashier || 'system'
    if (!ops[name]) {
      ops[name] = { count: 0, revenue: 0 }
    }
    ops[name].count++
    ops[name].revenue += s.price
  })
  
  return Object.entries(ops)
    .map(([name, o]) => ({
      name,
      count: o.count,
      revenue: o.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
})

const txCols = computed<ColumnDef<VoucherSale>[]>(() => [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.id),
  },
  {
    accessorKey: 'soldAt',
    header: 'Tanggal',
    cell: ({ row }) => {
      const d = new Date(row.original.soldAt)
      return h('div', null, [
        h(
          'div',
          { class: 'text-[12px]' },
          d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
        ),
        h(
          'div',
          { class: 'mono text-[10.5px]', style: 'color: var(--muted)' },
          d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        ),
      ])
    },
  },
  {
    accessorKey: 'voucher',
    header: 'Kode Voucher',
    cell: ({ row }) => h('span', { class: 'mono text-[12px] font-semibold' }, row.original.voucher),
  },
  {
    accessorKey: 'profile',
    header: 'Profile',
    cell: ({ row }) => h(Badge, { tone: 'cyan' }, () => row.original.profile),
  },
  {
    accessorKey: 'cashier',
    header: 'Kasir',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2' }, [
        h(Avatar, { name: row.original.cashier || 'system', size: 22 }),
        h('span', { class: 'text-[12px]' }, row.original.cashier || 'system'),
      ]),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'price',
    header: 'Harga',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'mono tabular text-[12.5px] font-semibold', style: 'color: var(--accent-lime)' },
        fmtRpShort(row.original.price),
      ),
    meta: { align: 'right' },
  },
])

// Kelompokkan data harian untuk grafik
const chartData = computed(() => {
  const days: Record<string, { revenue: number; volume: number }> = {}
  
  // Inisialisasi 7/14 hari terakhir agar grafik tidak kosong total
  for (let i = 14; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
    days[key] = { revenue: 0, volume: 0 }
  }

  salesList.value.forEach((s) => {
    const key = new Date(s.soldAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
    if (days[key]) {
      days[key].revenue += s.price
      days[key].volume++
    }
  })

  return {
    labels: Object.keys(days),
    revenue: Object.values(days).map((d) => d.revenue),
    volume: Object.values(days).map((d) => d.volume),
  }
})

const chartSeries = computed(() => [
  chartView.value === 'rev'
    ? { name: 'Revenue (Rp)', data: chartData.value.revenue, color: 'var(--accent-cyan)' }
    : {
        name: 'Volume (Voucher)',
        data: chartData.value.volume,
        color: 'var(--accent-violet)',
      },
])

async function downloadReport() {
  if (!activeDeviceId.value) return
  try {
    const blob = await reportsService.exportCsv(activeDeviceId.value, dateRange.value.from, dateRange.value.to)
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reports-sales-${range.value}-${todayStamp()}.csv`
    document.body.appendChild(a)
    a.click()
    a.remove()
    toast.success('Laporan CSV berhasil diunduh')
  } catch (err: any) {
    toast.error(`Gagal mengunduh CSV: ${err.message || err}`)
  }
}
</script>

<template>
  <div class="fade-in">
    <PageHeader title="Laporan" subtitle="Penjualan voucher, performa operator, top profiles">
      <template #right>
        <Segmented
          v-model="range"
          :options="[
            { value: 'today', label: 'Hari ini' },
            { value: '7d', label: '7d' },
            { value: '30d', label: '30d' },
            { value: '90d', label: '90d' },
          ]"
        />
        <button class="btn btn-sm" type="button" @click="downloadReport">
          <Icon name="Download" :size="13" />
          CSV
        </button>
      </template>
    </PageHeader>

    <div v-if="loadingSales" class="mb-4 flex items-center justify-center p-8">
      <div class="text-sm" style="color: var(--muted)">Loading reports...</div>
    </div>

    <div v-else>
      <div class="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewKpiCard
          label="Hari ini"
          :value="fmtRpShort(todayRevenue)"
          delta="terjual hari ini"
          trend="up"
          icon="Calendar"
          accent="lime"
        />
        <OverviewKpiCard
          label="Total Revenue"
          :value="fmtRpShort(totalRevenue)"
          :delta="`${totalCount} transaksi`"
          trend="up"
          icon="Report"
          accent="violet"
        />
        <OverviewKpiCard
          label="Penjualan Kemarin"
          :value="fmtRpShort(apiSummary?.totalRevenue || 0)"
          :delta="`${apiSummary?.totalSold || 0} voucher`"
          trend="flat"
          icon="Calendar"
          accent="cyan"
        />
        <OverviewKpiCard
          label="Operator terbaik"
          :value="operators[0]?.name || 'system'"
          :delta="`${operators[0]?.count || 0}× · ${fmtRpShort(operators[0]?.revenue || 0)}`"
          trend="up"
          icon="Users"
          accent="cyan"
        />
      </div>

      <Card class="mb-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div
              class="text-xs font-medium uppercase"
              style="color: var(--muted); letter-spacing: 0.05em"
            >
              Tren Penjualan
            </div>
            <div class="mt-1 flex items-baseline gap-2">
              <span class="text-2xl font-semibold" style="letter-spacing: -0.02em">{{
                fmtRp(totalRevenue)
              }}</span>
              <Badge tone="lime">{{ range }} filter</Badge>
            </div>
          </div>
          <Segmented
            v-model="chartView"
            :options="[
              { value: 'rev', label: 'Revenue' },
              { value: 'vol', label: 'Volume' },
            ]"
          />
        </div>
        <TrendChart :series="chartSeries" :x-labels="chartData.labels" :height="240" />
      </Card>

      <div class="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div class="mb-3 text-[13px] font-semibold">Top Profile</div>
          <table class="tbl">
            <thead>
              <tr>
                <th>Profile</th>
                <th>Terjual</th>
                <th>Avg</th>
                <th>Total</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in topProfiles" :key="p.profile">
                <td>
                  <Badge tone="cyan">{{ p.profile }}</Badge>
                </td>
                <td class="mono tabular">{{ p.count }}×</td>
                <td class="mono">{{ fmtRpShort(p.avg) }}</td>
                <td class="mono font-semibold" style="color: var(--accent-lime)">
                  {{ fmtRpShort(p.total) }}
                </td>
                <td>
                  <div class="flex items-center gap-2">
                    <div class="bar w-20"><i :style="{ width: `${p.share}%` }" /></div>
                    <span class="mono text-[11px]" style="color: var(--muted)">{{ p.share }}%</span>
                  </div>
                </td>
              </tr>
              <tr v-if="!topProfiles.length">
                <td colspan="5" class="p-8 text-center text-xs" style="color: var(--muted)">
                  Belum ada data penjualan pada periode ini.
                </td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card>
          <div class="mb-3 text-[13px] font-semibold">Performa Operator</div>
          <div class="space-y-3">
            <div
              v-for="op in operators"
              :key="op.name"
              class="row-hover flex items-center gap-3 rounded-lg p-2"
            >
              <Avatar :name="op.name" :size="32" />
              <div class="flex-1">
                <div class="text-[13px] font-medium">{{ op.name }}</div>
                <div class="text-[11px]" style="color: var(--muted)">{{ op.count }} transaksi</div>
              </div>
              <div class="text-right">
                <div class="mono text-sm font-semibold" style="color: var(--accent-lime)">
                  {{ fmtRpShort(op.revenue) }}
                </div>
                <div class="bar mt-1 w-20">
                  <i :style="{ width: `${operators[0] ? (op.revenue / operators[0].revenue) * 100 : 0}%` }" />
                </div>
              </div>
            </div>
            <div v-if="!operators.length" class="p-8 text-center text-xs" style="color: var(--muted)">
              Belum ada transaksi terekam.
            </div>
          </div>
        </Card>
      </div>

      <DataTable :columns="txCols" :data="salesList" :get-row-id="(t) => t.id" :page-size="10">
        <template #toolbar>
          <span class="text-xs" style="color: var(--muted)"
            >{{ totalCount }} transaksi · {{ range }}</span
          >
        </template>
      </DataTable>
    </div>
  </div>
</template>
