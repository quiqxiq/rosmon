<script setup lang="ts">
import { ref } from 'vue'
import Drawer from '@/components/ui/Drawer.vue'
import Icon from '@/components/ui/Icon.vue'
import Badge from '@/components/ui/Badge.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import { useActiveDevice } from '@/composables/useActiveDevice'
import {
  useUpdatePPPSecretMutation,
  useRemovePPPSecretMutation,
} from '@/queries/ppp.queries'
import { useToast } from '@/composables/useToast'
import { extractApiError } from '@/utils/http-error'
import type { PPPSecret } from '@/types/ppp'

const props = defineProps<{
  open: boolean
  secret: PPPSecret | null
  isOnline?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const toast = useToast()
const { activeDeviceId } = useActiveDevice()
const updateMutation = useUpdatePPPSecretMutation(activeDeviceId)
const removeMutation = useRemovePPPSecretMutation(activeDeviceId)

const showDeleteConfirm = ref(false)

async function toggleDisabled() {
  if (!props.secret) return
  const next = !props.secret.disabled
  try {
    await updateMutation.mutateAsync({ id: props.secret.id, input: { disabled: next } })
    toast.success(next ? `"${props.secret.name}" dinonaktifkan` : `"${props.secret.name}" diaktifkan`)
  } catch (e) {
    toast.error(extractApiError(e).message || 'Gagal mengubah status')
  }
}

async function confirmDelete() {
  if (!props.secret) return
  try {
    await removeMutation.mutateAsync(props.secret.id)
    toast.success(`Secret "${props.secret.name}" dihapus`)
    showDeleteConfirm.value = false
    emit('close')
  } catch (e) {
    toast.error(extractApiError(e).message || 'Gagal menghapus')
  }
}
</script>

<template>
  <Drawer
    :open="open"
    :title="secret ? secret.name : 'Detail PPP Secret'"
    @close="emit('close')"
  >
    <div v-if="secret" class="space-y-5">
      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Status
        </h3>
        <div class="flex items-center justify-between rounded-lg p-3" style="background: var(--bg-2)">
          <div class="flex flex-col gap-1">
            <Badge v-if="secret.disabled" tone="neutral">Disabled</Badge>
            <Badge v-else-if="isOnline" tone="success" dot>Online</Badge>
            <Badge v-else tone="neutral" dot>Offline</Badge>
          </div>
          <button
            class="btn btn-sm"
            type="button"
            :disabled="updateMutation.isPending.value"
            @click="toggleDisabled"
          >
            <Icon :name="secret.disabled ? 'Play' : 'Pause'" :size="12" />
            {{ secret.disabled ? 'Aktifkan' : 'Nonaktifkan' }}
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
          <div class="flex justify-between">
            <span style="color: var(--muted)">Username</span>
            <span class="mono font-medium">{{ secret.name }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Profil</span>
            <Badge tone="cyan">{{ secret.profile || '—' }}</Badge>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Service</span>
            <span class="mono text-[12px]">{{ secret.service || '—' }}</span>
          </div>
          <div v-if="secret.remote_address" class="flex justify-between">
            <span style="color: var(--muted)">Remote Address</span>
            <span class="mono text-[12px]">{{ secret.remote_address }}</span>
          </div>
          <div v-if="secret.local_address" class="flex justify-between">
            <span style="color: var(--muted)">Local Address</span>
            <span class="mono text-[12px]">{{ secret.local_address }}</span>
          </div>
          <div v-if="secret.caller_id" class="flex justify-between">
            <span style="color: var(--muted)">Caller ID</span>
            <span class="mono text-[12px]">{{ secret.caller_id }}</span>
          </div>
          <div v-if="secret.comment" class="pt-2" style="border-top: 1px solid var(--border)">
            <span style="color: var(--muted)">Comment</span>
            <p class="mt-1 text-sm">{{ secret.comment }}</p>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <button
        v-if="secret"
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
    title="Hapus PPP Secret"
    :message="secret ? `Hapus secret &quot;${secret.name}&quot;? Aksi ini akan dipropagate ke MikroTik.` : ''"
    confirm-text="Hapus"
    variant="danger"
    :loading="removeMutation.isPending.value"
    @close="showDeleteConfirm = false"
    @confirm="confirmDelete"
  />
</template>
