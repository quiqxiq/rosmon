<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import LiveTag from '@/components/ui/LiveTag.vue'
import type { IconName } from '@/components/ui/icons'

interface StreamEvent {
  id: number
  type: 'login' | 'logout' | 'kick' | 'connected'
  user: string
  detail: string
  time: string
}

const props = defineProps<{
  paused?: boolean
}>()

const events = ref<StreamEvent[]>([
  { id: 1, type: 'connected', user: 'system', detail: 'EventSource opened', time: 'now' },
])
let counter = 1

const map: Record<StreamEvent['type'], { icon: IconName; color: string; bg: string }> = {
  login: { icon: 'ArrowUpRight', color: 'var(--accent-cyan)', bg: 'var(--accent-cyan-soft)' },
  logout: { icon: 'Power', color: 'var(--muted)', bg: 'var(--bg-2)' },
  kick: { icon: 'Kick', color: 'var(--danger)', bg: 'rgba(244,63,94,0.12)' },
  connected: { icon: 'Activity', color: 'var(--accent-lime)', bg: 'var(--accent-lime-soft)' },
}

const userPool = ['lulu108', 'tio215', 'bagas088', 'rifqi142', 'maya070']

const intervalId = window.setInterval(() => {
  if (props.paused) return
  counter++
  const type = (['login', 'logout'] as const)[Math.floor(Math.random() * 2)]
  events.value.unshift({
    id: counter,
    type,
    user: userPool[Math.floor(Math.random() * userPool.length)],
    detail: type === 'login' ? 'login dari 10.5.50.x' : 'session ended',
    time: new Date().toLocaleTimeString('id-ID', { hour12: false }),
  })
  if (events.value.length > 30) events.value.pop()
}, 4200)

onBeforeUnmount(() => window.clearInterval(intervalId))
</script>

<template>
  <div class="card flex flex-col">
    <div class="mb-2 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="text-[13px] font-semibold">Event Stream</div>
        <LiveTag :on="!paused" :label="paused ? 'PAUSED' : 'LIVE'" />
      </div>
    </div>
    <div class="flex max-h-[360px] flex-col gap-0.5 overflow-y-auto">
      <div
        v-for="e in events"
        :key="e.id"
        class="row-hover flex items-start gap-2.5 rounded-lg px-1.5 py-2"
      >
        <div
          class="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-md"
          :style="{ background: map[e.type].bg, color: map[e.type].color }"
        >
          <Icon :name="map[e.type].icon" :size="12" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="text-[12.5px]">
            <span class="font-medium">{{ e.user }}</span>
            <span style="color: var(--muted)"> · {{ e.detail }}</span>
          </div>
        </div>
        <span class="mono shrink-0 text-[11px]" style="color: var(--muted-2)">{{ e.time }}</span>
      </div>
    </div>
  </div>
</template>
