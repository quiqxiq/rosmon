<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import { fmtAgoFromMs } from '@/utils/fmt'
import type { IconName } from '@/components/ui/icons'

const props = defineProps<{
  sales?: any[]
  active?: any[]
}>()

type ActivityType = 'login' | 'sale'

interface ActivityItem {
  type: ActivityType
  user: string
  detail: string
  time: Date
}

const map: Record<ActivityType, { icon: IconName; color: string; bg: string }> = {
  login: { icon: 'ArrowUpRight', color: 'var(--accent-cyan)', bg: 'var(--accent-cyan-soft)' },
  sale: { icon: 'Ticket', color: 'var(--accent-lime)', bg: 'var(--accent-lime-soft)' },
}

const items = computed<ActivityItem[]>(() => {
  const list: ActivityItem[] = []
  
  // 1. Tambah real sales (dari database)
  const salesList = props.sales ?? []
  salesList.forEach((s) => {
    list.push({
      type: 'sale',
      user: s.username || 'voucher',
      detail: `Voucher ${s.profile} terjual`,
      time: new Date(s.soldAt),
    })
  })
  
  // 2. Tambah real active sessions (dari router)
  const activeList = props.active ?? []
  activeList.forEach((u) => {
    // Sesi aktif dianggap login terkini
    list.push({
      type: 'login',
      user: u.user || u.name || 'Hotspot User',
      detail: `Terhubung dari ${u.address || 'RouterOS'}`,
      // Kita umpamakan timestamp aktif adalah sekarang/recent
      time: new Date(),
    })
  })
  
  // Urutkan berdasarkan waktu terbaru
  return list.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 6)
})

function cfg(a: ActivityItem) {
  return map[a.type]
}
</script>

<template>
  <div class="flex flex-col gap-0.5">
    <div v-if="!items.length" class="flex flex-col items-center justify-center py-8 text-center" style="color: var(--muted)">
      <Icon name="Activity" :size="24" style="margin-bottom: 6px; opacity: 0.5" />
      <span class="text-xs">Belum ada aktivitas</span>
    </div>
    <div
      v-else
      v-for="(a, i) in items"
      :key="i"
      class="row-hover flex items-center gap-2.5 rounded-lg px-1.5 py-2"
    >
      <div
        class="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-md"
        :style="{ background: cfg(a).bg, color: cfg(a).color }"
      >
        <Icon :name="cfg(a).icon" :size="13" />
      </div>
      <div class="min-w-0 flex-1">
        <div class="truncate text-[12.5px]">
          <span class="font-medium">{{ a.user }}</span>
          <span style="color: var(--muted)"> {{ a.detail }}</span>
        </div>
      </div>
      <span class="shrink-0 text-[11px]" style="color: var(--muted-2)">
        {{ fmtAgoFromMs(a.time.getTime()) }}
      </span>
    </div>
  </div>
</template>
