import type { ColumnDef } from '@tanstack/vue-table'

declare module '@tanstack/vue-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    mobileHidden?: boolean
    align?: 'left' | 'center' | 'right'
    width?: string | number
  }
}

export function selectColumn<T>(): ColumnDef<T> {
  return {
    id: '__select',
    enableSorting: false,
    enableGlobalFilter: false,
    meta: { width: 36 },
  }
}

export function actionsColumn<T>(): ColumnDef<T> {
  return {
    id: '__actions',
    enableSorting: false,
    enableGlobalFilter: false,
    meta: { align: 'right' },
  }
}
