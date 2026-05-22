<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '@/components/ui/Icon.vue'
import BrandMark from './BrandMark.vue'
import DeviceRow from './DeviceRow.vue'
import NavItem from './NavItem.vue'
import UserCard from './UserCard.vue'
import { DEVICES, NAV } from '@/fixtures/devices'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { useTweaks } from '@/composables/useTweaks'

const props = defineProps<{
  mobile?: boolean
}>()

defineEmits<{
  (e: 'navigate'): void
}>()

const route = useRoute()
const { sidebarMode } = useTweaks()
const { activeDeviceId, setActiveDevice } = useActiveDevice()

const compact = computed(() => !props.mobile && sidebarMode.value === 'icon')

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <aside :class="mobile ? 'sb-mobile' : 'sb'" :data-mode="mobile ? 'expanded' : sidebarMode">
    <!-- Brand -->
    <div class="flex items-center" style="height: 60px; padding: 16px 16px 12px">
      <BrandMark :small="compact" />
    </div>

    <!-- Devices section -->
    <div v-if="!compact" class="px-3 pb-1">
      <div class="flex items-center justify-between px-1 py-1.5">
        <span
          class="text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Devices
        </span>
        <button class="btn btn-ghost btn-xs btn-icon" title="Tambah device">
          <Icon name="Plus" :size="12" />
        </button>
      </div>
      <div class="flex flex-col gap-0.5">
        <DeviceRow
          v-for="d in DEVICES"
          :key="d.id"
          :device="d"
          :active="activeDeviceId === d.id"
          @click="setActiveDevice(d.id)"
        />
      </div>
    </div>

    <div v-if="!compact" class="divider" style="margin: 12px 16px" />

    <!-- Nav -->
    <div
      class="flex flex-1 flex-col gap-0.5 overflow-y-auto"
      :class="compact ? 'px-2.5 py-2' : 'px-3'"
    >
      <div
        v-if="!compact"
        class="px-2 py-1.5 text-[10px] font-semibold uppercase"
        style="color: var(--muted); letter-spacing: 0.08em"
      >
        Menu
      </div>
      <NavItem
        v-for="n in NAV"
        :key="n.id"
        :item="n"
        :active="isActive(n.to)"
        :compact="compact"
        @click="$emit('navigate')"
      />
    </div>

    <!-- User card -->
    <UserCard :compact="compact" name="Rendra Admin" role="operator · RT-08" />
  </aside>
</template>
