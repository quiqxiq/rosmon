<script setup lang="ts">
import { ref } from 'vue'
import Drawer from '@/components/ui/Drawer.vue'
import Icon from '@/components/ui/Icon.vue'
import Badge from '@/components/ui/Badge.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import HotspotProfileDBFormModal from './HotspotProfileDBFormModal.vue'
import { fmtDateTime, fmtRp } from '@/utils/fmt'
import type { HotspotProfileDB, HotspotProfileDBUpdateInput } from '@/types/hotspot-profile-db'
import {
  useUpdateHotspotProfileDBMutation,
  useRemoveHotspotProfileDBMutation,
} from '@/queries/hotspot-profiles-db.queries'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { useToast } from '@/composables/useToast'
import { extractApiError } from '@/utils/http-error'

const EXPIRY_MODE_LABEL: Record<string, string> = {
  '0': 'Tidak ada',
  rem: 'Remaining time',
  ntf: 'Next time full',
  remc: 'Remaining + cookie',
  ntfc: 'Next time full + cookie',
}

const props = defineProps<{
  open: boolean
  profile: HotspotProfileDB | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const toast = useToast()
const { activeDeviceId } = useActiveDevice()
const updateMutation = useUpdateHotspotProfileDBMutation(activeDeviceId)
const removeMutation = useRemoveHotspotProfileDBMutation(activeDeviceId)

const showEditForm = ref(false)
const showDeleteConfirm = ref(false)

async function saveEdit(payload: HotspotProfileDBUpdateInput) {
  if (!props.profile) return
  try {
    await updateMutation.mutateAsync({ id: props.profile.id, input: payload })
    toast.success(`Profil "${props.profile.name}" diperbarui`)
    showEditForm.value = false
  } catch (e) {
    toast.error(extractApiError(e).message || 'Gagal menyimpan')
  }
}

async function confirmDelete() {
  if (!props.profile) return
  try {
    await removeMutation.mutateAsync(props.profile.id)
    toast.success(`Profil "${props.profile.name}" dihapus`)
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
    :title="profile ? profile.name : 'Detail Profil Hotspot'"
    @close="emit('close')"
  >
    <div v-if="profile" class="space-y-5">
      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Identitas
        </h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span style="color: var(--muted)">Nama</span>
            <span class="mono font-medium">{{ profile.name }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Role</span>
            <Badge :tone="profile.role === 'permanent' ? 'cyan' : 'violet'">
              {{ profile.role === 'permanent' ? 'Permanent' : 'Voucher' }}
            </Badge>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Rate Limit</span>
            <span class="mono font-medium">{{ profile.rate_limit || '—' }}</span>
          </div>
          <div v-if="profile.description" class="flex justify-between">
            <span style="color: var(--muted)">Deskripsi</span>
            <span>{{ profile.description }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Status</span>
            <Badge :tone="profile.active ? 'success' : 'neutral'">
              {{ profile.active ? 'Aktif' : 'Nonaktif' }}
            </Badge>
          </div>
        </div>
      </section>

      <!-- Permanent billing -->
      <section v-if="profile.role === 'permanent'">
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Billing Bulanan
        </h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span style="color: var(--muted)">Harga / Bulan</span>
            <span class="font-semibold">{{ fmtRp(profile.price_monthly) }}</span>
          </div>
        </div>
      </section>

      <!-- Voucher config -->
      <section v-else>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Konfigurasi Voucher
        </h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span style="color: var(--muted)">Expiry mode</span>
            <span>{{ EXPIRY_MODE_LABEL[profile.expiry_mode] ?? profile.expiry_mode }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Validity</span>
            <span class="mono">{{ profile.validity || '—' }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Harga modal</span>
            <span>{{ fmtRp(profile.price) }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Harga jual</span>
            <span class="font-semibold">{{ fmtRp(profile.sell_price) }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Lock MAC</span>
            <Badge :tone="profile.lock_mac ? 'warn' : 'neutral'">
              {{ profile.lock_mac ? 'Ya' : 'Tidak' }}
            </Badge>
          </div>
        </div>
      </section>

      <section>
        <h3
          class="mb-2 text-[10px] font-semibold uppercase"
          style="color: var(--muted); letter-spacing: 0.08em"
        >
          Timestamps
        </h3>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span style="color: var(--muted)">Dibuat</span>
            <span class="text-xs">{{ fmtDateTime(profile.created_at) }}</span>
          </div>
          <div class="flex justify-between">
            <span style="color: var(--muted)">Diperbarui</span>
            <span class="text-xs">{{ fmtDateTime(profile.updated_at) }}</span>
          </div>
        </div>
      </section>
    </div>

    <template #footer>
      <button
        v-if="profile"
        class="btn btn-danger btn-sm"
        type="button"
        @click="showDeleteConfirm = true"
      >
        <Icon name="Trash" :size="13" />
        Hapus
      </button>
      <div class="flex-1" />
      <button class="btn btn-sm" type="button" @click="emit('close')">Tutup</button>
      <button
        v-if="profile"
        class="btn btn-primary btn-sm"
        type="button"
        @click="showEditForm = true"
      >
        <Icon name="Edit3" :size="13" />
        Edit
      </button>
    </template>
  </Drawer>

  <HotspotProfileDBFormModal
    :open="showEditForm"
    :initial="profile"
    :submitting="updateMutation.isPending.value"
    @close="showEditForm = false"
    @save="saveEdit"
  />

  <ConfirmModal
    :open="showDeleteConfirm"
    title="Hapus Profil Hotspot"
    :message="profile ? `Hapus profil &quot;${profile.name}&quot;? Langganan yang menggunakan profil ini perlu diperbarui secara manual.` : ''"
    confirm-text="Hapus"
    variant="danger"
    :loading="removeMutation.isPending.value"
    @close="showDeleteConfirm = false"
    @confirm="confirmDelete"
  />
</template>
