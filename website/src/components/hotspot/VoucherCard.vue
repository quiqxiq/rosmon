<script setup lang="ts">
import { fmtRpShort } from '@/utils/fmt'

defineProps<{
  code: string
  password: string
  profile: string
  speed: string
  price: number
  variant?: 'mini' | 'standar'
}>()
</script>

<template>
  <div class="voucher" :style="{ minWidth: variant === 'mini' ? '160px' : '200px' }">
    <div class="text-[10px] font-semibold tracking-widest uppercase" style="color: var(--muted)">
      HOTSPOT
    </div>
    <div class="mono mt-1 text-base font-bold tracking-wide" style="letter-spacing: 0.08em">
      {{ code }}
    </div>
    <div class="mono mt-0.5 text-[11px]" style="color: var(--muted)">pw: {{ password }}</div>
    <div class="mt-2 flex items-center justify-between text-[11px]" style="color: var(--text-2)">
      <span class="mono">{{ speed }}</span>
      <span class="font-semibold" style="color: var(--accent-cyan)">{{ fmtRpShort(price) }}</span>
    </div>
    <div class="mt-1 text-[10px]" style="color: var(--muted-2)">{{ profile }}</div>
  </div>
</template>
