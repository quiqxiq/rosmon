<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ColumnDef } from '@tanstack/vue-table'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import Badge from '@/components/ui/Badge.vue'
import Card from '@/components/ui/Card.vue'
import DataTable from '@/components/ui/DataTable.vue'
import Select from '@/components/ui/Select.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import SubscriptionFormModal from '@/components/subscriptions/SubscriptionFormModal.vue'
import StatusActionModal from '@/components/subscriptions/StatusActionModal.vue'
import SubscriptionDetailDrawer from '@/components/subscriptions/SubscriptionDetailDrawer.vue'
import {
  useSubscriptionsQuery,
  useCreateSubscriptionMutation,
  useUpdateSubscriptionMutation,
  usePatchSubscriptionStatusMutation,
  useReconcileSubscriptionMutation,
  useRemoveSubscriptionMutation,
} from '@/queries/subscriptions.queries'
import { useCustomersQuery } from '@/queries/customers.queries'
import { useToast } from '@/composables/useToast'
import { extractApiError } from '@/utils/http-error'
import type {
  ServiceType,
  Subscription,
  SubscriptionCreateInput,
  SubscriptionStatus,
} from '@/types/subscription'

const route = useRoute()
const router = useRouter()
const toast = useToast()

const search = ref('')
const filterStatus = ref<SubscriptionStatus | 'all'>('all')
const filterServiceType = ref<ServiceType | 'all'>('all')
const filterCustomerId = ref<number>(0)

onMounted(() => {
  const cid = route.query.customer_id
  if (cid && !Number.isNaN(Number(cid))) {
    filterCustomerId.value = Number(cid)
    // Pre-open create dengan preset customer.
    presetCustomerForCreate.value = Number(cid)
    showForm.value = true
  }
  const id = route.query.id
  if (id && !Number.isNaN(Number(id))) {
    // Buka detail saat data tersedia (lihat openDetailWhenReady).
    openIdFromRoute.value = Number(id)
  }
})

const queryFilter = computed(() => ({
  status: filterStatus.value === 'all' ? undefined : filterStatus.value,
  service_type: filterServiceType.value === 'all' ? undefined : filterServiceType.value,
  customer_id: filterCustomerId.value > 0 ? filterCustomerId.value : undefined,
}))

const { data: subscriptions, isPending } = useSubscriptionsQuery(queryFilter)
const { data: customers } = useCustomersQuery()

const filtered = computed(() => {
  const list = subscriptions.value ?? []
  const q = search.value.trim().toLowerCase()
  if (!q) return list
  return list.filter(
    (s) =>
      s.mikrotik_username.toLowerCase().includes(q) ||
      s.notes.toLowerCase().includes(q),
  )
})

const createMutation = useCreateSubscriptionMutation()
const updateMutation = useUpdateSubscriptionMutation()
const patchStatusMutation = usePatchSubscriptionStatusMutation()
const reconcileMutation = useReconcileSubscriptionMutation()
const removeMutation = useRemoveSubscriptionMutation()

const showForm = ref(false)
const editingSub = ref<Subscription | null>(null)
const presetCustomerForCreate = ref<number | undefined>(undefined)

const detailOpen = ref(false)
const detailSub = ref<Subscription | null>(null)
const openIdFromRoute = ref<number | null>(null)

const statusModalOpen = ref(false)
const statusTarget = ref<Subscription | null>(null)

const deleteCandidate = ref<Subscription | null>(null)

// Auto-open detail kalau route punya ?id= dan data sudah loaded.
watch(
  () => [openIdFromRoute.value, subscriptions.value] as const,
  ([id, list]) => {
    if (!id || !list) return
    const found = list.find((s) => s.id === id)
    if (found) {
      detailSub.value = found
      detailOpen.value = true
      openIdFromRoute.value = null
    }
  },
)

function openCreate() {
  editingSub.value = null
  presetCustomerForCreate.value = undefined
  showForm.value = true
}

function openEdit(s: Subscription) {
  editingSub.value = s
  presetCustomerForCreate.value = undefined
  detailOpen.value = false
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editingSub.value = null
  presetCustomerForCreate.value = undefined
}

function closeStatusModal() {
  statusModalOpen.value = false
  statusTarget.value = null
}

function openDetail(s: Subscription) {
  detailSub.value = s
  detailOpen.value = true
}

function openStatusModal(s: Subscription) {
  statusTarget.value = s
  detailOpen.value = false
  statusModalOpen.value = true
}

async function saveSubscription(payload: SubscriptionCreateInput) {
  try {
    if (editingSub.value) {
      const res = await updateMutation.mutateAsync({
        id: editingSub.value.id,
        input: {
          ppp_profile_id: payload.ppp_profile_id,
          hotspot_profile_id: payload.hotspot_profile_id,
          mikrotik_password: payload.mikrotik_password || undefined,
          notes: payload.notes,
        },
      })
      if (res.warning) toast.error(`Sync MikroTik: ${res.warning}`)
      else toast.success(`Langganan "${res.subscription.mikrotik_username}" diperbarui`)
    } else {
      const res = await createMutation.mutateAsync(payload)
      if (res.warning) {
        toast.error(
          `Langganan tersimpan, sync ke MikroTik gagal: ${res.warning}. Coba reconcile dari detail.`,
        )
      } else {
        toast.success(`Langganan "${res.subscription.mikrotik_username}" dibuat`)
      }
    }
    showForm.value = false
    editingSub.value = null
    presetCustomerForCreate.value = undefined
    // Clear query param customer_id supaya tidak re-open modal.
    if (route.query.customer_id) {
      router.replace({ name: 'subscriptions' })
    }
  } catch (e) {
    const err = extractApiError(e)
    toast.error(err.message || 'Gagal menyimpan langganan')
  }
}

async function confirmStatusChange(status: SubscriptionStatus) {
  if (!statusTarget.value) return
  try {
    const res = await patchStatusMutation.mutateAsync({
      id: statusTarget.value.id,
      input: { status },
    })
    if (res.warning) toast.error(`Sync MikroTik: ${res.warning}`)
    else toast.success(`Status diubah ke ${status}`)
    statusModalOpen.value = false
    statusTarget.value = null
  } catch (e) {
    const err = extractApiError(e)
    toast.error(err.message || 'Gagal ubah status')
  }
}

async function doReconcile(s: Subscription) {
  try {
    const res = await reconcileMutation.mutateAsync(s.id)
    if (res.warning) toast.error(`Reconcile warning: ${res.warning}`)
    else toast.success(`Reconcile sukses untuk ${s.mikrotik_username}`)
  } catch (e) {
    const err = extractApiError(e)
    toast.error(err.message || 'Gagal reconcile')
  }
}

async function doDelete() {
  if (!deleteCandidate.value) return
  const name = deleteCandidate.value.mikrotik_username
  try {
    const res = await removeMutation.mutateAsync(deleteCandidate.value.id)
    toast.success(`Langganan "${name}" dihapus`)
    if (res?.warning) toast.error(`Sync MikroTik: ${res.warning}`)
    deleteCandidate.value = null
    detailOpen.value = false
  } catch (e) {
    const err = extractApiError(e)
    toast.error(err.message || 'Gagal hapus langganan')
  }
}

const customerMap = computed(() => {
  const m = new Map<number, string>()
  for (const c of customers.value ?? []) m.set(c.id, c.full_name)
  return m
})

const isFormMutating = computed(
  () => createMutation.isPending.value || updateMutation.isPending.value,
)

const deleteMessage = computed(() =>
  deleteCandidate.value
    ? `Hapus langganan "${deleteCandidate.value.mikrotik_username}"? Secret/user di MikroTik akan ikut dihapus (best-effort).`
    : '',
)

function statusTone(status: string): 'success' | 'warn' | 'danger' | 'neutral' {
  if (status === 'active') return 'success'
  if (status === 'paused') return 'neutral'
  if (status === 'isolir') return 'warn'
  if (status === 'suspended' || status === 'terminated') return 'danger'
  return 'neutral'
}

const columns: ColumnDef<Subscription>[] = [
  {
    accessorKey: 'mikrotik_username',
    header: 'Username',
    cell: ({ row }) =>
      h('div', null, [
        h('div', { class: 'mono text-[13px] font-medium' }, row.original.mikrotik_username),
        h(
          'div',
          { class: 'text-[11px]', style: 'color: var(--muted)' },
          customerMap.value.get(row.original.customer_id) ?? `customer #${row.original.customer_id}`,
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
    accessorKey: 'device_id',
    header: 'Device',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, `#${row.original.device_id}`),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) =>
      h(Badge, { tone: statusTone(row.original.status) }, () => row.original.status),
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
            title: 'Ubah status',
            onClick: (e: Event) => {
              e.stopPropagation()
              openStatusModal(row.original)
            },
          },
          [h(Icon, { name: 'Activity', size: 14 })],
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-ghost btn-icon btn-sm',
            title: 'Reconcile',
            onClick: (e: Event) => {
              e.stopPropagation()
              doReconcile(row.original)
            },
          },
          [h(Icon, { name: 'Refresh', size: 14 })],
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'btn btn-ghost btn-icon btn-sm',
            title: 'Edit',
            onClick: (e: Event) => {
              e.stopPropagation()
              openEdit(row.original)
            },
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
            onClick: (e: Event) => {
              e.stopPropagation()
              deleteCandidate.value = row.original
            },
          },
          [h(Icon, { name: 'Trash2', size: 14 })],
        ),
      ]),
  },
]
</script>

<template>
  <div class="fade-in">
    <PageHeader title="Langganan" subtitle="Daftar subscription PPPoE & Hotspot permanent">
      <template #right>
        <button class="btn btn-primary btn-sm" type="button" @click="openCreate">
          <Icon name="Plus" :size="13" />
          Tambah Langganan
        </button>
      </template>
    </PageHeader>

    <Card>
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput v-model="search" placeholder="Cari username / catatan…" class="min-w-[240px]" />
        <Select
          v-model="filterStatus"
          :options="[
            { value: 'all', label: 'Semua status' },
            { value: 'pending_install', label: 'Pending' },
            { value: 'active', label: 'Active' },
            { value: 'isolir', label: 'Isolir' },
            { value: 'paused', label: 'Paused' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'terminated', label: 'Terminated' },
          ]"
        />
        <Select
          v-model="filterServiceType"
          :options="[
            { value: 'all', label: 'Semua tipe' },
            { value: 'pppoe', label: 'PPPoE' },
            { value: 'hotspot', label: 'Hotspot' },
          ]"
        />
        <div
          v-if="filterCustomerId > 0"
          class="ml-auto flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
          style="background: var(--accent-cyan-soft); color: var(--accent-cyan)"
        >
          <span>Filter pelanggan: {{ customerMap.get(filterCustomerId) ?? `#${filterCustomerId}` }}</span>
          <button type="button" @click="filterCustomerId = 0">
            <Icon name="X" :size="12" />
          </button>
        </div>
      </div>

      <div v-if="isPending" class="p-8 text-center text-sm" style="color: var(--muted)">
        Memuat langganan…
      </div>
      <DataTable
        v-else
        :columns="columns"
        :data="filtered"
        :get-row-id="(s) => String(s.id)"
        :page-size="20"
        empty-message="Belum ada langganan. Klik 'Tambah Langganan'."
        @row-click="(row) => openDetail(row)"
      />
    </Card>

    <SubscriptionFormModal
      :open="showForm"
      :initial="editingSub"
      :preset-customer-id="presetCustomerForCreate"
      :submitting="isFormMutating"
      @close="closeForm"
      @save="saveSubscription"
    />

    <SubscriptionDetailDrawer
      :open="detailOpen"
      :subscription="detailSub"
      @close="detailOpen = false"
      @edit="openEdit"
      @patch-status="openStatusModal"
      @reconcile="doReconcile"
      @delete="(s) => (deleteCandidate = s)"
    />

    <StatusActionModal
      :open="statusModalOpen"
      :subscription="statusTarget"
      :submitting="patchStatusMutation.isPending.value"
      @close="closeStatusModal"
      @confirm="confirmStatusChange"
    />

    <ConfirmModal
      :open="deleteCandidate !== null"
      title="Hapus langganan"
      :message="deleteMessage"
      confirm-text="Hapus"
      variant="danger"
      :loading="removeMutation.isPending.value"
      @close="deleteCandidate = null"
      @confirm="doDelete"
    />
  </div>
</template>
