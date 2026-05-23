<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import { fmtRpShort } from '@/utils/fmt'

const props = defineProps<{
  sales?: any[]
}>()

const items = computed(() => {
  const list = props.sales ?? []
  const groups: Record<string, { count: number; total: number }> = {}
  
  list.forEach((s) => {
    if (!s.profile) return
    if (!groups[s.profile]) {
      groups[s.profile] = { count: 0, total: 0 }
    }
    groups[s.profile].count++
    groups[s.profile].total += s.price
  })
  
  const colors = ['cyan', 'violet', 'lime']
  
  return Object.entries(groups)
    .map(([name, g], index) => ({
      name,
      sold: g.count,
      revenue: g.total,
      color: colors[index % colors.length]
    }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 4)
})

const max = computed(() => {
  const list = items.value
  if (!list.length) return 1
  return Math.max(...list.map((x) => x.sold))
})

function gradient(color: string) {
  const map = {
    cyan: 'linear-gradient(90deg, var(--accent-cyan), #67E3F4)',
    violet: 'linear-gradient(90deg, var(--accent-violet), #B292FF)',
    lime: 'linear-gradient(90deg, var(--accent-lime), #C5F36C)',
  } as const
  return map[color as keyof typeof map] ?? map.cyan
}

function tone(color: string) {
  const m = {
    cyan: { bg: 'var(--accent-cyan-soft)', color: 'var(--accent-cyan)' },
    violet: { bg: 'var(--accent-violet-soft)', color: 'var(--accent-violet)' },
    lime: { bg: 'var(--accent-lime-soft)', color: 'var(--accent-lime)' },
  } as const
  return m[color as keyof typeof m] ?? m.cyan
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div v-if="!items.length" class="flex flex-col items-center justify-center py-6 text-center" style="color: var(--muted)">
      <Icon name="Ticket" :size="24" style="margin-bottom: 6px; opacity: 0.5" />
      <span class="text-xs">Belum ada data penjualan</span>
    </div>
    <div v-else v-for="p in items" :key="p.name">
      <div class="mb-1.5 flex items-baseline justify-between">
        <span class="flex items-center gap-2 text-[13px]">
          <span
            class="flex h-[22px] w-[22px] items-center justify-center rounded-md text-[10px] font-semibold"
            :style="{ background: tone(p.color).bg, color: tone(p.color).color }"
          >
            <Icon name="Ticket" :size="12" />
          </span>
          <span class="font-medium">{{ p.name }}</span>
        </span>
        <span class="mono text-xs" style="color: var(--muted)">
          {{ p.sold }}× · {{ fmtRpShort(p.revenue) }}
        </span>
      </div>
      <div class="bar">
        <i :style="{ width: `${(p.sold / max) * 100}%`, background: gradient(p.color) }" />
      </div>
    </div>
  </div>
</template>
