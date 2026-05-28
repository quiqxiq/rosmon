<script setup lang="ts">
import { ref } from 'vue'
import Drawer from '@/components/ui/Drawer.vue'
import Icon from '@/components/ui/Icon.vue'
import Badge from '@/components/ui/Badge.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import { fmtBytes } from '@/utils/fmt'
import type { HotspotSession } from '@/types/hotspot'
import { useDisconnectActiveMutation } from '@/queries/hotspot.queries'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { useToast } from '@/composables/useToast'
import { extractApiError } from '@/utils/http-error'

const props = defineProps<{
  open: boolean
  session: HotspotSession | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const toast = useToast()
const { activeDeviceId } = useActiveDevice()
const disconnectMutation = useDisconnectActiveMutation(activeDeviceId)
const showConfirm = ref(false)

async function confirmDisconnect() {
  if (!props.session) return
  try {
    await disconnectMutation.mutateAsync(props.session.id)
    toast.success(`Sesi "${props.session.user}" diputus`)
    showConfirm.value = false
    emit('close')
  } catch (e) {
    toast.error(extractApiError(e).message || 'Gagal memutus sesi')
  }
}
</script>

<template>
  <Drawer
    :open="open"
    :title="session ? session.user : 'Detail Sesi Aktif'"
    @close="emit('close')"
  >
    <div v-if="session" class="space-y-5">
      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Identitas
        </h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span style="color: var(--muted)">User</span>
            <span class="mono font-medium">{{ session.user }}</span>
          </div>
          <div v-if="session.address" class="flex justify-between">
            <span style="color: var(--muted)">IP Address</span>
            <span class="mono text-[12px]">{{ session.address }}</span>
          </div>
          <div v-if="session.mac_address" class="flex justify-between">
            <span style="color: var(--muted)">MAC Address</span>
            <span class="mono text-[12px]">{{ session.mac_address }}</span>
          </div>
          <div v-if="session.server" class="flex justify-between">
            <span style="color: var(--muted)">Server</span>
            <Badge tone="neutral">{{ session.server }}</Badge>
          </div>
          <div v-if="session.login_by" class="flex justify-between">
            <span style="color: var(--muted)">Login by</span>
            <span class="mono text-[12px]">{{ session.login_by }}</span>
          </div>
        </div>
      </section>

      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Sesi
        </h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span style="color: var(--muted)">Uptime</span>
            <span class="mono font-medium">{{ session.uptime || '—' }}</span>
          </div>
          <div v-if="session.idle_time" class="flex justify-between">
            <span style="color: var(--muted)">Idle time</span>
            <span class="mono text-[12px]">{{ session.idle_time }}</span>
          </div>
          <div v-if="session.session_time_left" class="flex justify-between">
            <span style="color: var(--muted)">Sisa waktu</span>
            <span class="mono text-[12px]">{{ session.session_time_left }}</span>
          </div>
        </div>
      </section>

      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Traffic
        </h3>
        <div class="grid grid-cols-2 gap-3">
          <div
            class="rounded-lg p-3 text-center"
            style="background: var(--bg-2)"
          >
            <div class="text-[10px] uppercase" style="color: var(--muted)">Download</div>
            <div class="mt-1 text-sm font-semibold">{{ fmtBytes(session.bytes_in) }}</div>
          </div>
          <div
            class="rounded-lg p-3 text-center"
            style="background: var(--bg-2)"
          >
            <div class="text-[10px] uppercase" style="color: var(--muted)">Upload</div>
            <div class="mt-1 text-sm font-semibold">{{ fmtBytes(session.bytes_out) }}</div>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <button
        v-if="session"
        class="btn btn-danger btn-sm"
        type="button"
        @click="showConfirm = true"
      >
        <Icon name="WifiOff" :size="13" />
        Putuskan
      </button>
      <div class="flex-1" />
      <button class="btn btn-sm" type="button" @click="emit('close')">Tutup</button>
    </template>
  </Drawer>

  <ConfirmModal
    :open="showConfirm"
    title="Putuskan Sesi"
    :message="session ? `Putuskan sesi aktif untuk user &quot;${session.user}&quot;?` : ''"
    confirm-text="Putuskan"
    variant="danger"
    :loading="disconnectMutation.isPending.value"
    @close="showConfirm = false"
    @confirm="confirmDisconnect"
  />
</template>
