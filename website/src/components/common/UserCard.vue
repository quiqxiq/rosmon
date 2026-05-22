<script setup lang="ts">
import Avatar from '@/components/ui/Avatar.vue'
import Icon from '@/components/ui/Icon.vue'

defineProps<{
  compact: boolean
  name?: string
  role?: string
}>()

defineEmits<{
  (e: 'logout'): void
}>()
</script>

<template>
  <div :style="{ borderTop: '1px solid var(--border)' }" :class="compact ? 'p-2.5' : 'p-3'">
    <div v-if="compact" class="flex justify-center">
      <Avatar :name="name ?? 'Guest'" :size="32" />
    </div>
    <div
      v-else
      class="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2"
      style="background: var(--bg-2); border: 1px solid var(--border)"
    >
      <Avatar :name="name ?? 'Guest'" :size="32" />
      <div class="min-w-0 flex-1">
        <div class="truncate text-[13px] font-semibold">{{ name ?? 'Guest' }}</div>
        <div class="text-[11px]" style="color: var(--muted)">{{ role ?? '—' }}</div>
      </div>
      <button
        type="button"
        class="btn btn-ghost btn-icon btn-sm"
        title="Logout"
        @click="$emit('logout')"
      >
        <Icon name="Logout" :size="14" />
      </button>
    </div>
  </div>
</template>
