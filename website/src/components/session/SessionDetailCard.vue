<script setup lang="ts">
import { computed } from 'vue'
import Icon from '@/components/ui/Icon.vue'
import Avatar from '@/components/ui/Avatar.vue'
import Badge from '@/components/ui/Badge.vue'
import Spark from '@/components/ui/Spark.vue'
import { fmtBytes, fmtRate, fmtDuration } from '@/utils/fmt'
import type { FixtureHotspotActive } from '@/fixtures/hotspot'

const props = defineProps<{
  session: FixtureHotspotActive
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'kick'): void
}>()

const uptimeSec = computed(() => Math.floor((Date.now() - props.session.uptimeStart) / 1000))
</script>

<template>
  <div class="card slide-in-r flex flex-col gap-4">
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3">
        <div class="relative">
          <Avatar :name="session.user" :size="44" />
          <span
            class="dot dot-live absolute right-0 bottom-0"
            style="border: 2px solid var(--bg-1)"
          />
        </div>
        <div>
          <div class="text-sm font-semibold">{{ session.user }}</div>
          <div class="mt-1 flex flex-wrap gap-1.5">
            <Badge tone="cyan">{{ session.profile }}</Badge>
            <Badge tone="violet">{{ session.server }}</Badge>
          </div>
        </div>
      </div>
      <button class="btn btn-ghost btn-icon btn-sm" type="button" @click="$emit('close')">
        <Icon name="X" :size="14" />
      </button>
    </div>

    <div class="grid grid-cols-2 gap-2.5 text-xs">
      <div class="rounded-lg p-2.5" style="background: var(--bg-2)">
        <div style="color: var(--muted)">IP</div>
        <div class="mono mt-0.5 font-medium">{{ session.address }}</div>
      </div>
      <div class="rounded-lg p-2.5" style="background: var(--bg-2)">
        <div style="color: var(--muted)">MAC</div>
        <div class="mono mt-0.5 font-medium">{{ session.mac }}</div>
      </div>
      <div class="rounded-lg p-2.5" style="background: var(--bg-2)">
        <div style="color: var(--muted)">Uptime</div>
        <div class="mono mt-0.5 font-medium">{{ fmtDuration(uptimeSec) }}</div>
      </div>
      <div class="rounded-lg p-2.5" style="background: var(--bg-2)">
        <div style="color: var(--muted)">Login by</div>
        <div class="mono mt-0.5 font-medium">{{ session.loginBy }}</div>
      </div>
      <div class="rounded-lg p-2.5" style="background: var(--bg-2)">
        <div style="color: var(--muted)">Bytes In</div>
        <div class="mono mt-0.5 font-medium">{{ fmtBytes(session.bytesIn) }}</div>
      </div>
      <div class="rounded-lg p-2.5" style="background: var(--bg-2)">
        <div style="color: var(--muted)">Bytes Out</div>
        <div class="mono mt-0.5 font-medium">{{ fmtBytes(session.bytesOut) }}</div>
      </div>
    </div>

    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-xs" style="color: var(--muted)">Bandwidth (60s)</span>
        <span class="mono text-xs font-semibold">
          ↓ {{ fmtRate(session.rxRate) }} · ↑ {{ fmtRate(session.txRate) }}
        </span>
      </div>
      <Spark :data="session.sparkIn" kind="area" color="var(--accent-cyan)" :width="280" :height="40" />
    </div>

    <div class="flex flex-wrap gap-2">
      <button class="btn btn-sm flex-1" type="button">Detail User</button>
      <button class="btn btn-danger btn-sm flex-1" type="button" @click="$emit('kick')">
        <Icon name="Kick" :size="13" />
        Kick Session
      </button>
    </div>
  </div>
</template>
