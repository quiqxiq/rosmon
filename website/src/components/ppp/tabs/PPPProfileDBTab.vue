<script setup lang="ts">
import { computed, h, ref } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import DataTable from '@/components/ui/DataTable.vue'
import Badge from '@/components/ui/Badge.vue'
import Icon from '@/components/ui/Icon.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import PPPProfileDBDrawer from '@/components/ppp/PPPProfileDBDrawer.vue'
import PPPProfileDBFormModal from '@/components/ppp/PPPProfileDBFormModal.vue'
import { useActiveDevice } from '@/composables/useActiveDevice'
import {
  usePPPProfilesDBQuery,
  useCreatePPPProfileDBMutation,
  useSyncPPPProfilesMutation,
} from '@/queries/ppp-profiles-db.queries'
import { useToast } from '@/composables/useToast'
import { extractApiError } from '@/utils/http-error'
import { fmtRp } from '@/utils/fmt'
import type { PPPProfileDB, PPPProfileDBCreateInput } from '@/types/ppp-profile-db'

const toast = useToast()
const { activeDeviceId } = useActiveDevice()

const { data: profiles, isLoading } = usePPPProfilesDBQuery(activeDeviceId)
const createMutation = useCreatePPPProfileDBMutation(activeDeviceId)
const syncMutation = useSyncPPPProfilesMutation(activeDeviceId)

const selectedProfile = ref<PPPProfileDB | null>(null)
const showDrawer = ref(false)
const showCreateForm = ref(false)
const showSyncConfirm = ref(false)

function openDetail(p: PPPProfileDB) {
  selectedProfile.value = p
  showDrawer.value = true
}

function closeDrawer() {
  showDrawer.value = false
  selectedProfile.value = null
}

async function handleCreate(payload: PPPProfileDBCreateInput | unknown) {
  const input = payload as PPPProfileDBCreateInput
  try {
    await createMutation.mutateAsync(input)
    toast.success(`Profil "${input.name}" ditambahkan`)
    showCreateForm.value = false
  } catch (e) {
    toast.error(extractApiError(e).message || 'Gagal menambah profil')
  }
}

async function runSync() {
  try {
    const res = await syncMutation.mutateAsync()
    showSyncConfirm.value = false
    toast.success(
      `Sync selesai: ${res.synced.length} disinkron, ${res.created.length} baru, ${res.orphan.length} orphan`,
    )
  } catch (e) {
    toast.error(extractApiError(e).message || 'Sync gagal')
  }
}

const columns = computed<ColumnDef<PPPProfileDB>[]>(() => [
  {
    accessorKey: 'name',
    header: 'Nama',
    cell: ({ row }) =>
      h('div', null, [
        h('div', { class: 'mono text-[13px] font-medium' }, row.original.name),
        row.original.description
          ? h('div', { class: 'text-[11px]', style: 'color: var(--muted)' }, row.original.description)
          : null,
      ]),
  },
  {
    accessorKey: 'rate_limit',
    header: 'Rate Limit',
    cell: ({ row }) =>
      h('span', { class: 'mono text-[12px]' }, row.original.rate_limit || '—'),
  },
  {
    accessorKey: 'price_monthly',
    header: 'Harga / Bulan',
    cell: ({ row }) =>
      h('span', { class: 'text-sm font-medium' }, fmtRp(row.original.price_monthly)),
    meta: { mobileHidden: true },
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) =>
      h(Badge, { tone: row.original.active ? 'success' : 'neutral' }, () =>
        row.original.active ? 'Aktif' : 'Nonaktif',
      ),
  },
])
</script>

<template>
  <div>
    <div v-if="isLoading" class="flex items-center justify-center p-8">
      <div class="text-sm" style="color: var(--muted)">Memuat profil PPP...</div>
    </div>

    <DataTable
      v-else
      :columns="columns"
      :data="profiles ?? []"
      :get-row-id="(p) => String(p.id)"
      :page-size="15"
      clickable
      empty-message="Belum ada profil PPP. Tambah manual atau sync dari router."
      @row-click="openDetail"
    >
      <template #toolbar>
        <span class="text-xs" style="color: var(--muted)">
          {{ (profiles ?? []).length }} profil
        </span>
        <div class="flex-1" />
        <button
          class="btn btn-sm"
          type="button"
          :disabled="syncMutation.isPending.value"
          @click="showSyncConfirm = true"
        >
          <Icon name="RefreshCw" :size="13" />
          Sync dari Router
        </button>
        <button class="btn btn-primary btn-sm" type="button" @click="showCreateForm = true">
          <Icon name="Plus" :size="13" />
          Tambah Profil
        </button>
      </template>
    </DataTable>

    <PPPProfileDBDrawer
      :open="showDrawer"
      :profile="selectedProfile"
      @close="closeDrawer"
    />

    <PPPProfileDBFormModal
      :open="showCreateForm"
      :initial="null"
      :submitting="createMutation.isPending.value"
      @close="showCreateForm = false"
      @save="handleCreate"
    />

    <ConfirmModal
      :open="showSyncConfirm"
      title="Sync Profil dari Router"
      message="Profil PPP di router akan disinkronkan ke database. Profil yang sudah ada di DB tidak akan ditimpa konfigurasi billing-nya."
      confirm-text="Sync"
      :loading="syncMutation.isPending.value"
      @close="showSyncConfirm = false"
      @confirm="runSync"
    />
  </div>
</template>
