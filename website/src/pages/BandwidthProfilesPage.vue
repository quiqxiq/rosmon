<script setup lang="ts">
import { computed, h, ref } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import Badge from '@/components/ui/Badge.vue'
import Card from '@/components/ui/Card.vue'
import DataTable from '@/components/ui/DataTable.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import BandwidthProfileFormModal from '@/components/bandwidth/BandwidthProfileFormModal.vue'
import BandwidthProfileDetailDrawer from '@/components/bandwidth/BandwidthProfileDetailDrawer.vue'
import SyncResultModal from '@/components/bandwidth/SyncResultModal.vue'
import { useActiveDevice } from '@/composables/useActiveDevice'
import { useToast } from '@/composables/useToast'
import { extractApiError } from '@/utils/http-error'
import {
  useBandwidthProfilesQuery,
  useCreateBandwidthProfileMutation,
  useUpdateBandwidthProfileMutation,
  useRemoveBandwidthProfileMutation,
  useSyncBandwidthProfilesMutation,
} from '@/queries/bandwidth-profiles.queries'
import type {
  BandwidthProfile,
  BandwidthProfileCreateInput,
  BandwidthProfileSyncResponse,
} from '@/types/bandwidth-profile'
import { fmtRp } from '@/utils/fmt'

const toast = useToast()
const { activeDeviceId } = useActiveDevice()

const { data: profiles, isPending } = useBandwidthProfilesQuery(activeDeviceId)
const createMutation = useCreateBandwidthProfileMutation(activeDeviceId)
const updateMutation = useUpdateBandwidthProfileMutation(activeDeviceId)
const removeMutation = useRemoveBandwidthProfileMutation(activeDeviceId)
const syncMutation = useSyncBandwidthProfilesMutation(activeDeviceId)

const showForm = ref(false)
const editing = ref<BandwidthProfile | null>(null)
const deleteCandidate = ref<BandwidthProfile | null>(null)
const syncResult = ref<BandwidthProfileSyncResponse | null>(null)
const syncOpen = ref(false)
const detailOpen = ref(false)
const detailProfile = ref<BandwidthProfile | null>(null)

function openCreate() {
  editing.value = null
  showForm.value = true
}

function openDetail(p: BandwidthProfile) {
  detailProfile.value = p
  detailOpen.value = true
}

function openEdit(p: BandwidthProfile) {
  editing.value = p
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editing.value = null
}

async function save(payload: BandwidthProfileCreateInput) {
  try {
    if (editing.value) {
      const res = await updateMutation.mutateAsync({
        id: editing.value.id,
        input: {
          name: payload.name,
          rate_limit: payload.rate_limit ?? '',
          parent_queue: payload.parent_queue ?? '',
          local_address: payload.local_address ?? '',
          remote_address: payload.remote_address ?? '',
          session_timeout: payload.session_timeout ?? '',
          idle_timeout: payload.idle_timeout ?? '',
          address_pool: payload.address_pool ?? '',
          shared_users: payload.shared_users,
          price_monthly: payload.price_monthly,
          description: payload.description ?? '',
          active: payload.active,
        },
      })
      toast.success(`Paket "${res.profile.name}" diperbarui`)
      if (res.warning) toast.error(`Sync MikroTik: ${res.warning}`)
    } else {
      const res = await createMutation.mutateAsync(payload)
      toast.success(`Paket "${res.profile.name}" ditambahkan`)
      if (res.warning) toast.error(`Sync MikroTik: ${res.warning}`)
    }
    showForm.value = false
    editing.value = null
  } catch (e) {
    const err = extractApiError(e)
    toast.error(err.message || 'Gagal menyimpan paket')
  }
}

async function doDelete() {
  if (!deleteCandidate.value) return
  const name = deleteCandidate.value.name
  try {
    const res = await removeMutation.mutateAsync(deleteCandidate.value.id)
    toast.success(`Paket "${name}" dihapus`)
    if (res?.warning) toast.error(`Sync MikroTik: ${res.warning}`)
    deleteCandidate.value = null
  } catch (e) {
    const err = extractApiError(e)
    toast.error(err.message || 'Gagal menghapus paket')
  }
}

async function doSync() {
  try {
    const res = await syncMutation.mutateAsync()
    syncResult.value = res
    syncOpen.value = true
  } catch (e) {
    const err = extractApiError(e)
    toast.error(err.message || 'Gagal sync paket')
  }
}

const isFormMutating = computed(
  () => createMutation.isPending.value || updateMutation.isPending.value,
)

const deleteMessage = computed(() =>
  deleteCandidate.value
    ? `Hapus paket "${deleteCandidate.value.name}"? Paket yang masih dipakai langganan tidak bisa dihapus.`
    : '',
)

const columns: ColumnDef<BandwidthProfile>[] = [
  {
    accessorKey: 'name',
    header: 'Nama paket',
    cell: ({ row }) =>
      h('div', null, [
        h('div', { class: 'text-sm font-medium' }, row.original.name),
        h(
          'div',
          { class: 'mono text-[11px]', style: 'color: var(--muted)' },
          row.original.mikrotik_profile_name,
        ),
      ]),
  },
  {
    accessorKey: 'service_type',
    header: 'Tipe',
    cell: ({ row }) =>
      h(
        Badge,
        { tone: row.original.service_type === 'pppoe' ? 'violet' : 'cyan' },
        () => row.original.service_type.toUpperCase(),
      ),
  },
  {
    accessorKey: 'rate_limit',
    header: 'Rate limit',
    cell: ({ row }) =>
      h('span', { class: 'mono text-[12px]' }, row.original.rate_limit || 'unlimited'),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'price_monthly',
    header: 'Harga / bulan',
    cell: ({ row }) =>
      h('span', { class: 'text-[12px] font-medium' }, fmtRp(row.original.price_monthly)),
  },
  {
    accessorKey: 'active',
    header: 'Status',
    cell: ({ row }) =>
      h(
        Badge,
        { tone: row.original.active ? 'success' : 'neutral' },
        () => (row.original.active ? 'Aktif' : 'Non-aktif'),
      ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center justify-end gap-1' }, [
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-ghost btn-icon btn-sm',
            title: 'Edit',
            onClick: () => openEdit(row.original),
          },
          [h(Icon, { name: 'Edit3', size: 14 })],
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-ghost btn-icon btn-sm',
            title: 'Hapus',
            style: 'color: var(--danger)',
            onClick: () => (deleteCandidate.value = row.original),
          },
          [h(Icon, { name: 'Trash2', size: 14 })],
        ),
      ]),
  },
]
</script>

<template>
  <div class="fade-in">
    <PageHeader
      title="Paket Bandwidth"
      subtitle="Daftar paket PPPoE & Hotspot per device"
    >
      <template #right>
        <button
          class="btn btn-sm"
          type="button"
          :disabled="!activeDeviceId || syncMutation.isPending.value"
          @click="doSync"
        >
          <Icon name="Refresh" :size="13" />
          {{ syncMutation.isPending.value ? 'Sync…' : 'Sync dari router' }}
        </button>
        <button
          class="btn btn-primary btn-sm"
          type="button"
          :disabled="!activeDeviceId"
          @click="openCreate"
        >
          <Icon name="Plus" :size="13" />
          Tambah Paket
        </button>
      </template>
    </PageHeader>

    <Card>
      <div v-if="!activeDeviceId" class="p-8 text-center text-sm" style="color: var(--muted)">
        Pilih device aktif dari router switcher di sidebar untuk melihat paket.
      </div>
      <div v-else-if="isPending" class="p-8 text-center text-sm" style="color: var(--muted)">
        Memuat paket…
      </div>
      <DataTable
        v-else
        :columns="columns"
        :data="profiles ?? []"
        :get-row-id="(p) => String(p.id)"
        :page-size="20"
        :clickable="true"
        empty-message="Belum ada paket. Klik 'Sync dari router' untuk import, atau 'Tambah' untuk buat manual."
        @row-click="openDetail"
      />
    </Card>

    <BandwidthProfileFormModal
      :open="showForm"
      :initial="editing"
      :submitting="isFormMutating"
      @close="closeForm"
      @save="save"
    />

    <ConfirmModal
      :open="deleteCandidate !== null"
      title="Hapus paket"
      :message="deleteMessage"
      confirm-text="Hapus"
      variant="danger"
      :loading="removeMutation.isPending.value"
      @close="deleteCandidate = null"
      @confirm="doDelete"
    />

    <SyncResultModal
      :open="syncOpen"
      :result="syncResult"
      @close="syncOpen = false"
    />

    <BandwidthProfileDetailDrawer
      :open="detailOpen"
      :profile="detailProfile"
      @close="detailOpen = false"
      @edit="(p) => { detailOpen = false; openEdit(p) }"
      @delete="(p) => { detailOpen = false; deleteCandidate = p }"
    />
  </div>
</template>
