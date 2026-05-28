<script setup lang="ts">
import { ref } from 'vue'
import Drawer from '@/components/ui/Drawer.vue'
import Icon from '@/components/ui/Icon.vue'
import Badge from '@/components/ui/Badge.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import type { HotspotIpBinding } from '@/types/hotspot'
import {
  useSetBindingDisabledMutation,
  useRemoveBindingMutation,
} from '@/queries/hotspot.queries'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { useToast } from '@/composables/useToast'
import { extractApiError } from '@/utils/http-error'

const props = defineProps<{
  open: boolean
  binding: HotspotIpBinding | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const toast = useToast()
const { activeDeviceId } = useActiveDevice()
const setDisabledMutation = useSetBindingDisabledMutation(activeDeviceId)
const removeMutation = useRemoveBindingMutation(activeDeviceId)
const showDeleteConfirm = ref(false)

async function toggleDisabled() {
  if (!props.binding) return
  const next = !props.binding.disabled
  try {
    await setDisabledMutation.mutateAsync({ id: props.binding.id, disabled: next })
    toast.success(next ? 'Binding dinonaktifkan' : 'Binding diaktifkan')
  } catch (e) {
    toast.error(extractApiError(e).message || 'Gagal mengubah status')
  }
}

async function confirmDelete() {
  if (!props.binding) return
  try {
    await removeMutation.mutateAsync(props.binding.id)
    toast.success('Binding dihapus')
    showDeleteConfirm.value = false
    emit('close')
  } catch (e) {
    toast.error(extractApiError(e).message || 'Gagal menghapus binding')
  }
}

function typeTone(type: string): 'success' | 'danger' | 'neutral' {
  if (type === 'bypassed') return 'success'
  if (type === 'blocked') return 'danger'
  return 'neutral'
}
</script>

<template>
  <Drawer
    :open="open"
    :title="binding ? (binding.mac_address || binding.address || 'IP Binding') : 'Detail IP Binding'"
    @close="emit('close')"
  >
    <div v-if="binding" class="space-y-5">
      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Status
        </h3>
        <div class="flex items-center justify-between rounded-lg p-3" style="background: var(--bg-2)">
          <div class="flex flex-col gap-1">
            <Badge :tone="binding.disabled ? 'neutral' : 'success'" dot>
              {{ binding.disabled ? 'Disabled' : 'Enabled' }}
            </Badge>
          </div>
          <button
            class="btn btn-sm"
            type="button"
            :disabled="setDisabledMutation.isPending.value"
            @click="toggleDisabled"
          >
            <Icon :name="binding.disabled ? 'Play' : 'Pause'" :size="12" />
            {{ binding.disabled ? 'Aktifkan' : 'Nonaktifkan' }}
          </button>
        </div>
      </section>

      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Detail
        </h3>
        <div class="space-y-2 text-sm">
          <div v-if="binding.mac_address" class="flex justify-between">
            <span style="color: var(--muted)">MAC Address</span>
            <span class="mono text-[12px]">{{ binding.mac_address }}</span>
          </div>
          <div v-if="binding.address" class="flex justify-between">
            <span style="color: var(--muted)">IP Address</span>
            <span class="mono text-[12px]">{{ binding.address }}</span>
          </div>
          <div v-if="binding.to_address" class="flex justify-between">
            <span style="color: var(--muted)">To Address</span>
            <span class="mono text-[12px]">{{ binding.to_address }}</span>
          </div>
          <div v-if="binding.server" class="flex justify-between">
            <span style="color: var(--muted)">Server</span>
            <span class="mono text-[12px]">{{ binding.server }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Tipe</span>
            <Badge :tone="typeTone(binding.type)">{{ binding.type }}</Badge>
          </div>
          <div v-if="binding.comment" class="pt-2" style="border-top: 1px solid var(--border)">
            <span style="color: var(--muted)">Comment</span>
            <p class="mt-1">{{ binding.comment }}</p>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <button
        v-if="binding"
        class="btn btn-danger btn-sm"
        type="button"
        @click="showDeleteConfirm = true"
      >
        <Icon name="Trash" :size="13" />
        Hapus
      </button>
      <div class="flex-1" />
      <button class="btn btn-sm" type="button" @click="emit('close')">Tutup</button>
    </template>
  </Drawer>

  <ConfirmModal
    :open="showDeleteConfirm"
    title="Hapus IP Binding"
    message="Hapus binding ini dari MikroTik?"
    confirm-text="Hapus"
    variant="danger"
    :loading="removeMutation.isPending.value"
    @close="showDeleteConfirm = false"
    @confirm="confirmDelete"
  />
</template>
