<script setup lang="ts">
import { computed, h, ref } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import Tabs from '@/components/ui/Tabs.vue'
import Badge from '@/components/ui/Badge.vue'
import Avatar from '@/components/ui/Avatar.vue'
import Card from '@/components/ui/Card.vue'
import DataTable from '@/components/ui/DataTable.vue'
import OverviewKpiCard from '@/components/overview/OverviewKpiCard.vue'
import { useActiveDevice } from '@/composables/useActiveDevice'
import {
  usePPPSecretsQuery,
  usePPPActiveQuery,
  usePPPProfilesQuery,
  useCreatePPPProfileMutation,
  useUpdatePPPProfileMutation,
  useRemovePPPProfileMutation,
} from '@/queries/ppp.queries'
import { useToast } from '@/composables/useToast'
import type { PPPSecret, PPPActive, PPPProfile, PPPProfileCreateInput } from '@/types/ppp'
import PPPProfileFormModal from '@/components/ppp/PPPProfileFormModal.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import { extractApiError } from '@/utils/http-error'

const toast = useToast()
const { activeDeviceId } = useActiveDevice()

type TabId = 'secret' | 'active' | 'profile' | 'inactive'
const tab = ref<TabId>('secret')

// Query Hooks
const { data: apiSecrets, refetch: refetchSecrets, isLoading: loadingSecrets } = usePPPSecretsQuery(activeDeviceId)
const { data: apiActive, refetch: refetchActive, isLoading: loadingActive } = usePPPActiveQuery(activeDeviceId)
const { data: apiProfiles, refetch: refetchProfiles, isLoading: loadingProfiles } = usePPPProfilesQuery(activeDeviceId)

const activeNames = computed(() => {
  return new Set((apiActive.value ?? []).map((s) => s.name))
})

const inactiveSecrets = computed(() => {
  const secrets = apiSecrets.value ?? []
  return secrets.filter((s) => !activeNames.value.has(s.name))
})

const tabs = computed(() => [
  { id: 'secret' as const, label: 'Secret', icon: 'Lock' as const, count: (apiSecrets.value ?? []).length },
  {
    id: 'active' as const,
    label: 'Active',
    icon: 'Activity' as const,
    count: (apiActive.value ?? []).length,
    live: true,
  },
  { id: 'profile' as const, label: 'Profile', icon: 'Wifi' as const, count: (apiProfiles.value ?? []).length },
  {
    id: 'inactive' as const,
    label: 'Inactive',
    icon: 'Power' as const,
    count: inactiveSecrets.value.length,
  },
])

const secretCols = computed<ColumnDef<PPPSecret>[]>(() => [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) =>
      h('div', null, [
        h('div', { class: 'mono text-[13px] font-medium' }, row.original.name),
        row.original.comment
          ? h('div', { class: 'text-[11px]', style: 'color: var(--muted)' }, row.original.comment)
          : null,
      ]),
  },
  {
    accessorKey: 'profile',
    header: 'Profile',
    cell: ({ row }) => h(Badge, { tone: 'cyan' }, () => row.original.profile),
  },
  {
    accessorKey: 'service',
    header: 'Service',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.service),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'remote_address',
    header: 'Remote Address',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.remote_address || '—'),
    meta: { mobileHidden: true },
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const isOnline = activeNames.value.has(row.original.name)
      if (row.original.disabled) return h(Badge, { tone: 'neutral' }, () => 'Disabled')
      return h(Badge, { tone: isOnline ? 'success' : 'neutral', dot: true }, () =>
        isOnline ? 'Online' : 'Offline',
      )
    },
  },
])

const activeCols = computed<ColumnDef<PPPActive>[]>(() => [
  {
    accessorKey: 'name',
    header: 'User',
    cell: ({ row }) =>
      h('div', { class: 'flex items-center gap-2.5' }, [
        h(Avatar, { name: row.original.name, size: 28 }),
        h('span', { class: 'mono text-[13px] font-medium' }, row.original.name),
      ]),
  },
  {
    accessorKey: 'service',
    header: 'Service',
    cell: ({ row }) => h(Badge, { tone: 'cyan' }, () => row.original.service),
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.address || '—'),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'uptime',
    header: 'Uptime',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.uptime || '—'),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'encoding',
    header: 'Encoding',
    cell: ({ row }) => h('span', { class: 'text-xs mono', style: 'color: var(--muted)' }, row.original.encoding || '—'),
  },
])

function reload() {
  if (activeDeviceId.value) {
    refetchSecrets()
    refetchActive()
    refetchProfiles()
    toast.success('Data PPP disinkronkan!')
  }
}

// ── PPP Profile CRUD ────────────────────────────────────────────────────
const createProfileMutation = useCreatePPPProfileMutation(activeDeviceId)
const updateProfileMutation = useUpdatePPPProfileMutation(activeDeviceId)
const removeProfileMutation = useRemovePPPProfileMutation(activeDeviceId)

const showProfileForm = ref(false)
const editingProfile = ref<PPPProfile | null>(null)
const deleteCandidate = ref<PPPProfile | null>(null)

function openCreateProfile() {
  editingProfile.value = null
  showProfileForm.value = true
}

function openEditProfile(p: PPPProfile) {
  editingProfile.value = p
  showProfileForm.value = true
}

function closeProfileForm() {
  showProfileForm.value = false
  editingProfile.value = null
}

const editingInitial = computed<PPPProfileCreateInput | null>(() => {
  const p = editingProfile.value
  if (!p) return null
  return {
    name: p.name,
    local_address: p.local_address,
    remote_address: p.remote_address,
    rate_limit: p.rate_limit,
    session_timeout: p.session_timeout,
    idle_timeout: p.idle_timeout,
    parent_queue: p.parent_queue,
    on_up: p.on_up,
    on_down: p.on_down,
    disabled: p.disabled,
    comment: p.comment,
  }
})

async function saveProfile(payload: PPPProfileCreateInput) {
  try {
    if (editingProfile.value) {
      await updateProfileMutation.mutateAsync({ id: editingProfile.value.id, input: payload })
      toast.success(`Profile "${payload.name}" diperbarui`)
    } else {
      await createProfileMutation.mutateAsync(payload)
      toast.success(`Profile "${payload.name}" ditambahkan`)
    }
    showProfileForm.value = false
    editingProfile.value = null
  } catch (e) {
    const err = extractApiError(e)
    toast.error(err.message || 'Gagal menyimpan profile')
  }
}

async function confirmDeleteProfile() {
  if (!deleteCandidate.value) return
  try {
    await removeProfileMutation.mutateAsync(deleteCandidate.value.id)
    toast.success(`Profile "${deleteCandidate.value.name}" dihapus`)
    deleteCandidate.value = null
  } catch (e) {
    const err = extractApiError(e)
    toast.error(err.message || 'Gagal menghapus profile')
  }
}

const isProfileMutating = computed(
  () => createProfileMutation.isPending.value || updateProfileMutation.isPending.value,
)

const deleteMessage = computed(() =>
  deleteCandidate.value
    ? `Hapus profile "${deleteCandidate.value.name}"? Aksi ini akan dipropagate ke MikroTik.`
    : '',
)
</script>

<template>
  <div class="fade-in">
    <PageHeader title="PPP" subtitle="PPPoE secrets, active sessions, profiles & inactive">
      <template #right>
        <button class="btn btn-sm" type="button" @click="reload">
          <Icon name="Refresh" :size="13" />
          Reload
        </button>
      </template>
    </PageHeader>

    <div v-if="loadingSecrets || loadingActive || loadingProfiles" class="mb-4 flex items-center justify-center p-8">
      <div class="text-sm" style="color: var(--muted)">Loading PPP data...</div>
    </div>

    <div v-else>
      <Tabs v-model="tab" :tabs="tabs" class="mb-4" />

      <!-- Secret -->
      <div v-if="tab === 'secret'">
        <DataTable
          :columns="secretCols"
          :data="apiSecrets ?? []"
          :get-row-id="(s) => s.id"
          :page-size="10"
        >
          <template #toolbar>
            <span class="text-xs" style="color: var(--muted)">{{ (apiSecrets ?? []).length }} secrets</span>
          </template>
        </DataTable>
      </div>

      <!-- Active -->
      <div v-else-if="tab === 'active'">
        <div class="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <OverviewKpiCard
            label="Active Sessions"
            :value="(apiActive ?? []).length"
            delta="live"
            trend="flat"
            icon="Activity"
            accent="cyan"
            live
          />
        </div>
        <DataTable
          :columns="activeCols"
          :data="apiActive ?? []"
          :get-row-id="(s) => s.id"
          :page-size="10"
        />
      </div>

      <!-- Profile -->
      <div v-else-if="tab === 'profile'">
        <div class="mb-3 flex items-center justify-between">
          <span class="text-xs" style="color: var(--muted)">
            {{ (apiProfiles ?? []).length }} profile
          </span>
          <button class="btn btn-primary btn-sm" type="button" @click="openCreateProfile">
            <Icon name="Plus" :size="13" />
            Tambah Profile
          </button>
        </div>
        <div
          v-if="(apiProfiles ?? []).length === 0"
          class="rounded-lg p-8 text-center text-sm"
          style="background: var(--bg-2); color: var(--muted)"
        >
          Belum ada PPP profile. Klik "Tambah Profile" untuk membuat baru.
        </div>
        <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card v-for="p in apiProfiles ?? []" :key="p.id" accent="var(--accent-violet)">
          <div class="mb-3 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div
                class="flex h-9 w-9 items-center justify-center rounded-lg"
                style="background: var(--accent-violet-soft); color: var(--accent-violet)"
              >
                <Icon name="Wifi" :size="16" />
              </div>
              <div>
                <div class="text-sm font-semibold">{{ p.name }}</div>
                <div class="mono text-[11px]" style="color: var(--muted)">{{ p.id }}</div>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <button
                class="btn btn-ghost btn-icon btn-sm"
                type="button"
                title="Edit"
                @click="openEditProfile(p)"
              >
                <Icon name="Edit3" :size="14" />
              </button>
              <button
                class="btn btn-ghost btn-icon btn-sm"
                type="button"
                title="Hapus"
                style="color: var(--danger)"
                @click="deleteCandidate = p"
              >
                <Icon name="Trash2" :size="14" />
              </button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div style="color: var(--muted)">Rate Limit</div>
              <div class="mono font-medium">{{ p.rate_limit || 'unlimited' }}</div>
            </div>
            <div>
              <div style="color: var(--muted)">Local Address</div>
              <div class="mono font-medium">{{ p.local_address || '—' }}</div>
            </div>
            <div>
              <div style="color: var(--muted)">Remote Address</div>
              <div class="mono font-medium">{{ p.remote_address || '—' }}</div>
            </div>
            <div>
              <div style="color: var(--muted)">Session Timeout</div>
              <div class="mono font-medium">{{ p.session_timeout || '—' }}</div>
            </div>
            <div>
              <div style="color: var(--muted)">Idle Timeout</div>
              <div class="mono font-medium">{{ p.idle_timeout || '—' }}</div>
            </div>
          </div>
        </Card>
        </div>
      </div>

      <!-- Inactive -->
      <div v-else-if="tab === 'inactive'">
        <DataTable
          :columns="secretCols"
          :data="inactiveSecrets"
          :get-row-id="(s) => s.id"
          :page-size="10"
          empty-message="Tidak ada secret inactive"
        />
      </div>
    </div>

    <PPPProfileFormModal
      :open="showProfileForm"
      :initial="editingInitial"
      :submitting="isProfileMutating"
      @close="closeProfileForm"
      @save="saveProfile"
    />

    <ConfirmModal
      :open="deleteCandidate !== null"
      title="Hapus PPP profile"
      :message="deleteMessage"
      confirm-text="Hapus"
      variant="danger"
      :loading="removeProfileMutation.isPending.value"
      @close="deleteCandidate = null"
      @confirm="confirmDeleteProfile"
    />
  </div>
</template>
