<script setup lang="ts">
withDefaults(defineProps<{ small?: boolean }>(), { small: false })
</script>

<template>
  <div class="flex items-center gap-2.5">
    <div
      class="relative flex shrink-0 items-center justify-center"
      style="
        width: 30px;
        height: 30px;
        border-radius: 9px;
        background: linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-violet) 100%);
        box-shadow: 0 4px 16px rgba(34, 211, 238, 0.35);
      "
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#06121A"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M3 12 L8 7 L13 12 L8 17 Z" />
        <path d="M11 12 L16 7 L21 12 L16 17 Z" />
      </svg>
    </div>
    <div v-if="!small" class="flex flex-col" style="line-height: 1">
      <span class="text-[15px] font-bold" style="letter-spacing: -0.02em">
        roslib<span style="color: var(--accent-cyan)">/</span>admin
      </span>
      <span
        class="mt-1 text-[10px]"
        style="color: var(--muted); letter-spacing: 0.02em"
      >
        RouterOS · Mikhmon
      </span>
    </div>
  </div>
</template>
