<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMediaQuery } from '@vueuse/core'
import Icon from '@/components/ui/Icon.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import StatusDot from '@/components/ui/StatusDot.vue'
import PingIndicator from './PingIndicator.vue'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { useDevicesQuery } from '@/queries/devices.queries'
import { useTweaks } from '@/composables/useTweaks'
import { useToast } from '@/composables/useToast'

const emit = defineEmits<{
  (e: 'menu'): void
  (e: 'sidebar-cycle'): void
}>()

const router = useRouter()
const toast = useToast()
const { activeDeviceId } = useActiveDevice()
const { theme, toggleTheme } = useTweaks()
const isLg = useMediaQuery('(min-width: 1024px)')
const isMd = useMediaQuery('(min-width: 768px)')
const isSm = useMediaQuery('(min-width: 640px)')

const { data: devicesList } = useDevicesQuery()

const dev = computed(() => {
  const list = devicesList.value ?? []
  return list.find((d) => String(d.id) === String(activeDeviceId.value)) ?? list[0] ?? null
})

const search = ref('')

const baseMs = computed(() => {
  if (!dev.value) return 999
  const s = dev.value.status
  return s === 'connecting' ? 65 : s === 'disconnected' || s === 'error' ? 999 : 12
})

const mappedStatus = computed<'online' | 'offline' | 'warn' | 'danger'>(() => {
  const s = dev.value?.status
  if (s === 'connected') return 'online'
  if (s === 'connecting') return 'warn'
  if (s === 'disconnected') return 'offline'
  if (s === 'error') return 'danger'
  return 'offline'
})

function onHamburger() {
  if (isLg.value) emit('sidebar-cycle')
  else emit('menu')
}

function gotoVoucher() {
  router.push('/hotspot/voucher')
}

function refreshDevice() {
  toast.info(`Refreshed ${dev.value?.slug ?? '—'}`)
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
      <span class="text-sm font-semibold">{{ dev?.displayName || dev?.slug || '—' }}</span>
      <StatusDot :status="mappedStatus" :show-label="false" />
    </div>

    <div v-if="isMd" class="divider-v" style="height: 22px; margin: 0 2px" />
    <PingIndicator v-if="isMd" :base-ms="baseMs" />

    <div v-if="isMd" class="flex flex-1 justify-center">
      <SearchInput v-model="search" placeholder="Cari user, voucher, IP, MAC, profile…" />
    </div>
    <div v-else class="flex-1" />

    <div class="flex items-center gap-1.5">
      <button
        v-if="isSm"
        class="btn btn-ghost btn-icon"
        type="button"
        title="Refresh"
        @click="refreshDevice"
      >
        <Icon name="Refresh" :size="16" />
      </button>
      <button v-if="isSm" class="btn btn-ghost btn-icon relative" type="button" title="Notifikasi">
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
      <button
        class="btn btn-ghost btn-icon"
        type="button"
        title="Settings"
        @click="router.push('/settings')"
      >
        <Icon name="Cog" :size="16" />
      </button>
      <button class="btn btn-ghost btn-icon" type="button" title="Tema" @click="toggleTheme">
        <Icon :name="theme === 'dark' ? 'Sun' : 'Moon'" :size="16" />
      </button>
      <div v-if="isMd" class="divider-v" style="height: 24px; margin: 0 4px" />
      <button v-if="isMd" class="btn btn-primary btn-sm" type="button" @click="gotoVoucher">
        <Icon name="Plus" :size="14" />
        Voucher Baru
      </button>
      <button
        v-else
        class="btn btn-primary btn-icon btn-sm"
        type="button"
        title="Voucher Baru"
        @click="gotoVoucher"
      >
        <Icon name="Plus" :size="14" />
      </button>
    </div>

  </header>
</template>
