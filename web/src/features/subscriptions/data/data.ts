import { type SubscriptionStatus } from './schema'

export const STATUS_TONE: Record<SubscriptionStatus, 'online' | 'offline'> = {
  active: 'online',
  pending_install: 'offline',
  isolir: 'offline',
  suspended: 'offline',
  terminated: 'offline',
}

export const statusOptions = [
  { label: 'Active', value: 'active' as const },
  { label: 'Pending', value: 'pending_install' as const },
  { label: 'Isolir', value: 'isolir' as const },
  { label: 'Suspended', value: 'suspended' as const },
  { label: 'Terminated', value: 'terminated' as const },
]

export const serviceTypeOptions = [
  { label: 'PPPoE', value: 'pppoe' as const },
  { label: 'Hotspot', value: 'hotspot' as const },
]
