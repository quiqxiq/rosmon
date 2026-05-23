<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BrandMark from './BrandMark.vue'
import NavItem from './NavItem.vue'
import RouterTrigger from './RouterTrigger.vue'
import UserCard from './UserCard.vue'
import { NAV } from '@/fixtures/devices'
import { useTweaks } from '@/composables/useTweaks'
import { useAuthStore } from '@/stores/auth'
import { authService } from '@/services/auth'

const props = defineProps<{
  mobile?: boolean
}>()

defineEmits<{
  (e: 'navigate'): void
}>()

const route = useRoute()
const router = useRouter()
const { sidebarMode } = useTweaks()
const authStore = useAuthStore()

const compact = computed(() => !props.mobile && sidebarMode.value === 'icon')

const userName = computed(() => authStore.user?.username || 'Guest')
const userRole = computed(() => {
  const r = authStore.user?.role || 'viewer'
  return `${r} · MikroTik`
})

function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}

async function onLogout() {
  try {
    if (authStore.refreshToken) {
      await authService.logout(authStore.refreshToken)
    }
  } catch (err) {
    console.error('Logout failed:', err)
  } finally {
    authStore.reset()
    router.push('/login')
  }
}
</script>

<template>
  <aside :class="mobile ? 'sb-mobile' : 'sb'" :data-mode="mobile ? 'expanded' : sidebarMode">
    <!-- Brand -->
    <div class="flex items-center" style="height: 60px; padding: 16px 16px 12px">
      <BrandMark :small="compact" />
    </div>

    <!-- Router Switcher -->
    <div v-if="!compact" class="px-3 pb-2">
      <RouterTrigger @select="$emit('navigate')" />
    </div>

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
    <UserCard
      :compact="compact"
      :name="userName"
      :role="userRole"
      @logout="onLogout"
    />
  </aside>
</template>
