<script setup lang="ts" generic="T extends Record<string, unknown>">
import { computed, ref, watch } from 'vue'
import {
  FlexRender,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import Icon from './Icon.vue'
import Checkbox from './Checkbox.vue'
import Pagination from './Pagination.vue'

const props = withDefaults(
  defineProps<{
    columns: ColumnDef<T>[]
    data: T[]
    getRowId: (row: T) => string
    globalFilter?: string
    pageSize?: number
    enableRowSelection?: boolean
    emptyMessage?: string
    clickable?: boolean
  }>(),
  {
    globalFilter: '',
    pageSize: 10,
    enableRowSelection: false,
    emptyMessage: 'Tidak ada data',
    clickable: false,
  },
)

const emit = defineEmits<{
  (e: 'update:globalFilter', value: string): void
  (e: 'rowClick', row: T): void
  (e: 'selectionChange', rowIds: string[]): void
}>()

const sorting = ref<SortingState>([])
const rowSelection = ref<RowSelectionState>({})
const filter = ref(props.globalFilter)

watch(
  () => props.globalFilter,
  (v) => {
    filter.value = v
  },
)
watch(filter, (v) => {
  emit('update:globalFilter', v)
})

const allColumns = computed<ColumnDef<T>[]>(() => {
  if (!props.enableRowSelection) return props.columns
  const selCol: ColumnDef<T> = {
    id: '__select',
    enableSorting: false,
    enableGlobalFilter: false,
    meta: { width: 36 },
    header: ({ table }) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      h(Checkbox as any, {
        modelValue: table.getIsAllPageRowsSelected(),
        indeterminate: table.getIsSomePageRowsSelected(),
        'onUpdate:modelValue': (v: boolean) => table.toggleAllPageRowsSelected(v),
      }),
    cell: ({ row }) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      h(Checkbox as any, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (v: boolean) => row.toggleSelected(v),
      }),
  }
  return [selCol, ...props.columns]
})

const table = useVueTable({
  get data() {
    return props.data
  },
  get columns() {
    return allColumns.value
  },
  state: {
    get sorting() {
      return sorting.value
    },
    get globalFilter() {
      return filter.value
    },
    get rowSelection() {
      return rowSelection.value
    },
  },
  enableRowSelection: () => props.enableRowSelection,
  getRowId: (row) => props.getRowId(row),
  onSortingChange: (updater) => {
    sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater
  },
  onGlobalFilterChange: (v) => {
    filter.value = typeof v === 'function' ? v(filter.value) : v
  },
  onRowSelectionChange: (updater) => {
    rowSelection.value = typeof updater === 'function' ? updater(rowSelection.value) : updater
  },
  initialState: { pagination: { pageSize: props.pageSize } },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
})

watch(
  rowSelection,
  (sel) => {
    emit('selectionChange', Object.keys(sel).filter((k) => sel[k]))
  },
  { deep: true },
)

import { h } from 'vue'

const total = computed(() => table.getFilteredRowModel().rows.length)
const totalPages = computed(() => table.getPageCount() || 1)
const page = computed(() => table.getState().pagination.pageIndex + 1)
const perPage = computed(() => table.getState().pagination.pageSize)
const selectedCount = computed(() => Object.keys(rowSelection.value).filter((k) => rowSelection.value[k]).length)

function goPage(p: number) {
  table.setPageIndex(p - 1)
}

function clearSelection() {
  rowSelection.value = {}
}

defineExpose({ table, clearSelection })
</script>

<template>
  <div class="card" style="padding: 0; overflow: hidden">
    <div
      v-if="$slots.toolbar"
      class="flex flex-wrap items-center gap-3 p-3"
      style="border-bottom: 1px solid var(--border)"
    >
      <slot name="toolbar" :table="table" :filter="filter" :setFilter="(v: string) => (filter = v)" />
    </div>
    <div
      v-if="selectedCount > 0 && $slots.bulkBar"
      class="flex items-center justify-between gap-3 px-4 py-2"
      :style="{
        background: 'var(--accent-cyan-soft)',
        borderBottom: '1px solid var(--border)',
      }"
    >
      <slot name="bulkBar" :selectedCount="selectedCount" :clear="clearSelection" />
    </div>
    <div class="overflow-x-auto">
      <table class="tbl" :class="{ 'tbl-clickable': clickable }">
        <thead>
          <tr>
            <th
              v-for="header in table.getHeaderGroups()[0].headers"
              :key="header.id"
              :style="{
                width: header.column.columnDef.meta?.width
                  ? `${header.column.columnDef.meta.width}px`
                  : undefined,
                textAlign: header.column.columnDef.meta?.align ?? 'left',
                cursor: header.column.getCanSort() ? 'pointer' : 'default',
              }"
              @click="header.column.getToggleSortingHandler()?.($event)"
            >
              <span class="inline-flex items-center gap-1">
                <FlexRender
                  v-if="!header.isPlaceholder"
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
                <Icon
                  v-if="header.column.getIsSorted() === 'asc'"
                  name="Up"
                  :size="12"
                  :style="{ color: 'var(--accent-cyan)' }"
                />
                <Icon
                  v-else-if="header.column.getIsSorted() === 'desc'"
                  name="Down"
                  :size="12"
                  :style="{ color: 'var(--accent-cyan)' }"
                />
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!table.getRowModel().rows.length">
            <td :colspan="table.getAllColumns().length" class="text-center" style="color: var(--muted)">
              <slot name="empty">{{ emptyMessage }}</slot>
            </td>
          </tr>
          <tr
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            :data-selected="row.getIsSelected() ? 'true' : 'false'"
            @click="clickable && $emit('rowClick', row.original)"
          >
            <td
              v-for="cell in row.getVisibleCells()"
              :key="cell.id"
              :style="{
                textAlign: cell.column.columnDef.meta?.align ?? 'left',
                width: cell.column.columnDef.meta?.width
                  ? `${cell.column.columnDef.meta.width}px`
                  : undefined,
              }"
            >
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <Pagination
      v-if="total > perPage"
      :page="page"
      :total-pages="totalPages"
      :total="total"
      :per-page="perPage"
      @change="goPage"
    />
  </div>
</template>
