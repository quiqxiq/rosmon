<script setup lang="ts">
import { computed, h, ref } from 'vue'
import type { ColumnDef } from '@tanstack/vue-table'
import PageHeader from '@/components/ui/PageHeader.vue'
import Icon from '@/components/ui/Icon.vue'
import Badge from '@/components/ui/Badge.vue'
import Card from '@/components/ui/Card.vue'
import DataTable from '@/components/ui/DataTable.vue'
import SearchInput from '@/components/ui/SearchInput.vue'
import Select from '@/components/ui/Select.vue'
import ConfirmModal from '@/components/ui/ConfirmModal.vue'
import CustomerFormModal from '@/components/customers/CustomerFormModal.vue'
import CustomerDetailDrawer from '@/components/customers/CustomerDetailDrawer.vue'
import OnboardCustomerWizard from '@/components/customers/OnboardCustomerWizard.vue'
import {
  useCustomersQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useRemoveCustomerMutation,
} from '@/queries/customers.queries'
import { useToast } from '@/composables/useToast'
import { extractApiError } from '@/utils/http-error'
import type { Customer, CustomerCreateInput } from '@/types/customer'

const toast = useToast()

const search = ref('')
const filterStatus = ref<'all' | 'aktif' | 'nonaktif'>('all')

const queryFilter = computed(() => ({
  q: search.value.trim() || undefined,
  status: filterStatus.value === 'all' ? undefined : filterStatus.value,
}))

const { data: customers, isPending } = useCustomersQuery(queryFilter)
const createMutation = useCreateCustomerMutation()
const updateMutation = useUpdateCustomerMutation()
const removeMutation = useRemoveCustomerMutation()

const showForm = ref(false)
const editingCustomer = ref<Customer | null>(null)
const showWizard = ref(false)

const detailOpen = ref(false)
const detailCustomer = ref<Customer | null>(null)

const deleteCandidate = ref<Customer | null>(null)

function openCreate() {
  // Wizard menggabungkan create customer + first subscription dalam 2 step.
  showWizard.value = true
}

function openEdit(c: Customer) {
  editingCustomer.value = c
  detailOpen.value = false
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editingCustomer.value = null
}

function openDetail(c: Customer) {
  detailCustomer.value = c
  detailOpen.value = true
}

async function saveCustomer(payload: CustomerCreateInput) {
  try {
    if (editingCustomer.value) {
      await updateMutation.mutateAsync({ id: editingCustomer.value.id, input: payload })
      toast.success(`Pelanggan "${payload.full_name}" diperbarui`)
    } else {
      await createMutation.mutateAsync(payload)
      toast.success(`Pelanggan "${payload.full_name}" ditambahkan`)
    }
    showForm.value = false
    editingCustomer.value = null
  } catch (e) {
    const err = extractApiError(e)
    toast.error(err.message || 'Gagal menyimpan pelanggan')
  }
}

async function doDelete() {
  if (!deleteCandidate.value) return
  const name = deleteCandidate.value.full_name
  try {
    await removeMutation.mutateAsync(deleteCandidate.value.id)
    toast.success(`Pelanggan "${name}" dihapus`)
    deleteCandidate.value = null
  } catch (e) {
    const err = extractApiError(e)
    toast.error(err.message || 'Gagal menghapus pelanggan')
  }
}

const isFormMutating = computed(
  () => createMutation.isPending.value || updateMutation.isPending.value,
)

const deleteMessage = computed(() =>
  deleteCandidate.value
    ? `Hapus pelanggan "${deleteCandidate.value.full_name}"? Pelanggan dengan langganan aktif tidak bisa dihapus.`
    : '',
)

const columns: ColumnDef<Customer>[] = [
  {
    accessorKey: 'full_name',
    header: 'Nama',
    cell: ({ row }) =>
      h('div', null, [
        h('div', { class: 'text-sm font-medium' }, row.original.full_name),
        h('div', { class: 'text-[11px]', style: 'color: var(--muted)' }, row.original.area || '—'),
      ]),
  },
  {
    accessorKey: 'phone',
    header: 'WhatsApp',
    cell: ({ row }) => h('span', { class: 'mono text-[12px]' }, row.original.phone),
  },
  {
    accessorKey: 'address',
    header: 'Alamat',
    cell: ({ row }) =>
      h('span', { class: 'text-xs', style: 'color: var(--muted)' }, row.original.address || '—'),
    meta: { mobileHidden: true },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) =>
      h(
        Badge,
        { tone: row.original.status === 'aktif' ? 'success' : 'neutral' },
        () => row.original.status,
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
    <PageHeader title="Pelanggan" subtitle="Daftar pelanggan rumahan & UMKM" />

    <Card>
      <div class="mb-4 flex flex-wrap items-center gap-3">
        <SearchInput v-model="search" placeholder="Cari nama, no. WA, area…" class="min-w-[240px]" />
        <Select
          v-model="filterStatus"
          :options="[
            { value: 'all', label: 'Semua status' },
            { value: 'aktif', label: 'Aktif' },
            { value: 'nonaktif', label: 'Non-aktif' },
          ]"
        />
        <div class="ml-auto">
          <button class="btn btn-primary btn-sm" type="button" @click="openCreate">
            <Icon name="Plus" :size="13" />
            Tambah Pelanggan
          </button>
        </div>
      </div>

      <div v-if="isPending" class="p-8 text-center text-sm" style="color: var(--muted)">
        Memuat pelanggan…
      </div>
      <DataTable
        v-else
        :columns="columns"
        :data="customers ?? []"
        :get-row-id="(c) => String(c.id)"
        :page-size="20"
        empty-message="Belum ada pelanggan terdaftar"
        @row-click="(row) => openDetail(row)"
      />
    </Card>

    <CustomerFormModal
      :open="showForm"
      :initial="editingCustomer"
      :submitting="isFormMutating"
      @close="closeForm"
      @save="saveCustomer"
    />

    <OnboardCustomerWizard
      :open="showWizard"
      @close="showWizard = false"
      @done="showWizard = false"
    />

    <CustomerDetailDrawer
      :open="detailOpen"
      :customer="detailCustomer"
      @close="detailOpen = false"
      @edit="openEdit"
      @add-subscription="(c) => $router.push({ name: 'subscriptions', query: { customer_id: String(c.id) } })"
    />

    <ConfirmModal
      :open="deleteCandidate !== null"
      title="Hapus pelanggan"
      :message="deleteMessage"
      confirm-text="Hapus"
      variant="danger"
      :loading="removeMutation.isPending.value"
      @close="deleteCandidate = null"
      @confirm="doDelete"
    />
  </div>
</template>
