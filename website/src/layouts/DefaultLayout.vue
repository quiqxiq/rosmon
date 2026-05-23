<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import { useMediaQuery, watchDebounced } from '@vueuse/core'
import Sidebar from '@/components/common/Sidebar.vue'
import Topbar from '@/components/common/Topbar.vue'
import { useTweaks } from '@/composables/useTweaks'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { useDevicesQuery } from '@/queries/devices.queries'

const { cycleSidebar } = useTweaks()
const { activeDeviceId, setActiveDevice } = useActiveDevice()
const isLg = useMediaQuery('(min-width: 1024px)')
const mobileOpen = ref(false)
const route = useRoute()

// Auto-init active device from real API devices list
const { data: devicesList } = useDevicesQuery()
watch(
  devicesList,
  (list) => {
    if (list && list.length && !activeDeviceId.value) {
      setActiveDevice(String(list[0].id))
    }
  },
  { immediate: true },
)

watchDebounced(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
  },
  { debounce: 50 },
)
</script>

<template>
  <div class="flex h-full">
    <Sidebar v-if="isLg" />
    <Sidebar v-else-if="mobileOpen" mobile @navigate="mobileOpen = false" />
    <div
      v-if="!isLg && mobileOpen"
      class="overlay"
      style="z-index: 199"
      @click="mobileOpen = false"
    />

    <div class="main-bg flex min-w-0 flex-1 flex-col">
      <Topbar @menu="mobileOpen = true" @sidebar-cycle="cycleSidebar" />
      <main class="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
