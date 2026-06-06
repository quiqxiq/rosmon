import { type CustomerStatus } from './schema'

export const callTypes = new Map<CustomerStatus, string>([
  ['aktif', 'bg-teal-100/30 text-teal-900 dark:text-teal-200 border-teal-200'],
  ['nonaktif', 'bg-neutral-300/40 border-neutral-300'],
])

export const statusOptions = [
  {
    label: 'Aktif',
    value: 'aktif' as const,
  },
  {
    label: 'Nonaktif',
    value: 'nonaktif' as const,
  },
]
