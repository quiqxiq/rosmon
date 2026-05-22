<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import Icon from '@/components/ui/Icon.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import StatusDot from '@/components/ui/StatusDot.vue'
import TweaksPanel from './TweaksPanel.vue'
import { DEVICES } from '@/fixtures/devices'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { useTweaks } from '@/composables/useTweaks'

const emit = defineEmits<{
  (e: 'menu'): void
  (e: 'sidebar-cycle'): void
}>()

const { activeDeviceId } = useActiveDevice()
const { theme, toggleTheme } = useTweaks()
const isLg = useMediaQuery('(min-width: 1024px)')
const isMd = useMediaQuery('(min-width: 768px)')
const isSm = useMediaQuery('(min-width: 640px)')

const dev = computed(() => DEVICES.find((d) => d.id === activeDeviceId.value) ?? DEVICES[0])

const tweaksOpen = ref(false)
const search = ref('')

function onHamburger() {
  if (isLg.value) emit('sidebar-cycle')
  else emit('menu')
}
</script>

<template>
  <header class="tb">
    <button
      class="btn btn-ghost btn-icon"
      type="button"
      title="Toggle sidebar"
      @click="onHamburger"
    >
      <Icon name="Menu" :size="18" />
    </button>

    <div v-if="isSm" class="flex items-center gap-2">
      <Icon name="Server" :size="16" :style="{ color: 'var(--muted)' }" />
      <span class="text-sm" style="color: var(--muted)">Device</span>
      <Icon name="Chevron" :size="12" :style="{ color: 'var(--muted-2)' }" />
      <span class="text-sm font-semibold">{{ dev.slug }}</span>
      <StatusDot :status="dev.status" :show-label="false" />
    </div>

    <div v-if="isMd" class="flex flex-1 justify-center">
      <SearchInput
        v-model="search"
        placeholder="Cari user, voucher, IP, MAC, profile…"
      />
    </div>
    <div v-else class="flex-1" />

    <div class="flex items-center gap-1.5">
      <button v-if="isSm" class="btn btn-ghost btn-icon" type="button" title="Refresh">
        <Icon name="Refresh" :size="16" />
      </button>
      <button
        v-if="isSm"
        class="btn btn-ghost btn-icon relative"
        type="button"
        title="Notifikasi"
      >
        <Icon name="Bell" :size="16" />
        <span
          class="absolute rounded-full"
          style="
            top: 7px;
            right: 8px;
            width: 7px;
            height: 7px;
            background: var(--accent-cyan);
            box-shadow: 0 0 0 2px var(--bg);
          "
        />
      </button>
      <button class="btn btn-ghost btn-icon" type="button" title="Tweaks" @click="tweaksOpen = !tweaksOpen">
        <Icon name="Cog" :size="16" />
      </button>
      <button class="btn btn-ghost btn-icon" type="button" title="Tema" @click="toggleTheme">
        <Icon :name="theme === 'dark' ? 'Sun' : 'Moon'" :size="16" />
      </button>
      <div v-if="isMd" class="divider-v" style="height: 24px; margin: 0 4px" />
      <button v-if="isMd" class="btn btn-primary btn-sm" type="button">
        <Icon name="Plus" :size="14" />
        Voucher Baru
      </button>
      <button v-else class="btn btn-primary btn-icon btn-sm" type="button" title="Voucher Baru">
        <Icon name="Plus" :size="14" />
      </button>
    </div>

    <TweaksPanel :open="tweaksOpen" @close="tweaksOpen = false" />
  </header>
</template>
